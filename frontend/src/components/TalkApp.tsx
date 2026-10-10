"use client";

import { useEffect, useRef, useState } from "react";
import SourceCard from "./SourceCard";

const API = "";
const REFUSAL = "The records I have don't say.";

type TalkSource = {
  id: number;
  body: string;
  date: string;
  page: number;
  pdf_url: string | null;
  is_draft: boolean;
};

type Phase = "idle" | "listening" | "searching" | "ready";

type Recording = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
};

type Turn = {
  id: number;
  question: string;
  answer: string;
  sources: TalkSource[];
  sourcesOpen: boolean;
  kind: "" | "chat" | "records";
  pending: boolean;
};

function Wave() {
  return (
    <span className="talk-wave" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

export function TalkOrb({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "talk-orb talk-orb-sm" : "talk-orb"}>
      <Wave />
    </span>
  );
}

export default function TalkApp() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [audioUrl, setAudioUrl] = useState("");
  const [note, setNote] = useState("");
  const [level, setLevel] = useState(0);
  const recordingRef = useRef<Recording | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const turnIdRef = useRef(1);
  const meterRef = useRef<number>(0);
  const meterContextRef = useRef<AudioContext | null>(null);

  function patchTurn(id: number, patch: Partial<Turn>) {
    setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));
  }

  function stopMeter() {
    cancelAnimationFrame(meterRef.current);
    setLevel(0);
    meterContextRef.current?.close();
    meterContextRef.current = null;
  }

  function watchLevel(stream: MediaStream) {
    const context = new AudioContext();
    meterContextRef.current = context;
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) {
        const centered = (value - 128) / 128;
        sum += centered * centered;
      }
      setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 8));
      meterRef.current = requestAnimationFrame(tick);
    };
    meterRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    return () => {
      const recording = recordingRef.current;
      recordingRef.current = null;
      if (recording && recording.recorder.state !== "inactive") recording.recorder.stop();
      recording?.stream.getTracks().forEach((track) => track.stop());
      cancelAnimationFrame(meterRef.current);
      meterContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    audio.src = audioUrl;
    audio.play().catch(() => setNote("Audio unavailable."));
  }, [audioUrl]);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }, [turns]);

  async function ask(question: string, turnId: number) {
    const trimmed = question.trim();
    if (!trimmed) {
      setPhase("idle");
      setNote("I didn't hear a question.");
      return;
    }

    setPhase("searching");
    setNote("");
    audioRef.current?.pause();
    setAudioUrl("");

    try {
      const response = await fetch(`${API}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      if (!response.ok || !response.body) {
        throw new Error("ask failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      let nextSources: TalkSource[] = [];
      let answerId = "";
      let error = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          let event = "";
          let data = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!event || !data) continue;
          const payload = JSON.parse(data) as {
            text?: string;
            sources?: TalkSource[];
            answer_id?: string;
            message?: string;
            kind?: string;
          };
          if (event === "route" && (payload.kind === "chat" || payload.kind === "records")) {
            patchTurn(turnId, { kind: payload.kind });
          }
          if (event === "sources") nextSources = payload.sources ?? [];
          if (event === "delta") {
            text += payload.text ?? "";
            patchTurn(turnId, { answer: text });
          }
          if (event === "done") answerId = payload.answer_id ?? "";
          if (event === "error") error = payload.message ?? "Unable to answer.";
        }
      }

      if (error || !answerId) {
        patchTurn(turnId, { pending: false });
        setNote(error || "Unable to answer.");
        setPhase("idle");
        return;
      }

      patchTurn(turnId, { answer: text, sources: nextSources, pending: false });
      if (text.trim() === REFUSAL) {
        setPhase("ready");
        return;
      }

      const brief = await fetch(`${API}/api/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_id: answerId }),
      });
      const body = (await brief.json()) as {
        audio_url?: string;
        script?: string;
        detail?: { script?: string; message?: string } | string;
      };
      if (!brief.ok || !body.audio_url) {
        setNote("Audio unavailable.");
        setPhase("ready");
        return;
      }
      setAudioUrl(`${API}${body.audio_url}`);
      setPhase("ready");
    } catch {
      patchTurn(turnId, { pending: false });
      setNote("Unable to answer.");
      setPhase("idle");
    }
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNote("This browser cannot hear you. Use Chrome.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recordingRef.current = { recorder, stream, chunks };
      watchLevel(stream);
      setNote("");
      setPhase("listening");
      recorder.start();
    } catch {
      setPhase("idle");
      setNote("Microphone access was blocked.");
    }
  }

  function stop() {
    const recording = recordingRef.current;
    if (!recording || recording.recorder.state === "inactive") {
      setPhase("idle");
      setNote("I didn't hear a question.");
      return;
    }
    recording.recorder.onstop = () => {
      stopMeter();
      recording.stream.getTracks().forEach((track) => track.stop());
      recordingRef.current = null;
      const blob = new Blob(recording.chunks, { type: recording.recorder.mimeType || "audio/webm" });
      void transcribe(blob);
    };
    recording.recorder.stop();
  }

  async function transcribe(blob: Blob) {
    if (blob.size < 200) {
      setPhase("idle");
      setNote("I didn't hear a question.");
      return;
    }
    setPhase("searching");
    setNote("");
    try {
      const form = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      form.append("file", blob, `question.${extension}`);
      const response = await fetch(`${API}/api/transcribe`, { method: "POST", body: form });
      const body = (await response.json()) as { text?: string };
      if (!response.ok) {
        setPhase("idle");
        setNote("Could not transcribe that. Try again.");
        return;
      }
      const spoken = (body.text ?? "").trim();
      if (!spoken) {
        setPhase("idle");
        setNote("I didn't hear a question.");
        return;
      }
      const turnId = turnIdRef.current++;
      setTurns((current) => [
        ...current,
        { id: turnId, question: spoken, answer: "", sources: [], sourcesOpen: false, kind: "", pending: true },
      ]);
      await ask(spoken, turnId);
    } catch {
      setPhase("idle");
      setNote("Could not transcribe that. Try again.");
    }
  }

  const listening = phase === "listening";
  const waitingOnSpeech = phase === "searching" && turns.every((turn) => !turn.pending);
  const status = listening
    ? "Listening. Speak, then press Stop."
    : waitingOnSpeech
      ? "Turning your speech into a question..."
      : turns.length === 0
        ? "Press Listen, ask about the town records, then press Stop."
        : "";

  return (
    <div className="talk-body">
      <div className="talk-log" ref={logRef} aria-live="polite">
        {turns.map((turn) => (
          <div className="talk-exchange" key={turn.id}>
            <div className="talk-row talk-row-user">
              <p className="talk-bubble talk-bubble-user">{turn.question}</p>
            </div>
            {turn.pending || turn.answer ? (
              <div className="talk-row talk-row-gavel">
                <div className="talk-gavel-stack">
                  <p className="talk-bubble talk-bubble-gavel">
                    {turn.answer ||
                      (turn.kind === "records" ? "Searching the records..." : "One moment...")}
                  </p>
                  {turn.sources.length > 0 ? (
                    <>
                      <button
                        type="button"
                        className="gel-btn-light talk-sources-btn"
                        aria-expanded={turn.sourcesOpen}
                        onClick={() => patchTurn(turn.id, { sourcesOpen: !turn.sourcesOpen })}
                      >
                        <span className="gel-label">
                          {turn.sources.length === 1 ? "1 source" : `${turn.sources.length} sources`}
                        </span>
                      </button>
                      {turn.sourcesOpen ? (
                        <div className="source-list talk-sources">
                          {turn.sources.map((source) => (
                            <SourceCard
                              key={source.id}
                              number={source.id}
                              body={source.body}
                              date={source.date}
                              page={source.page}
                              status={source.is_draft ? "draft" : "final"}
                              pdfUrl={source.pdf_url}
                            />
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="talk-composer">
        {status ? <p className="talk-status">{status}</p> : null}
        {note ? <p className="talk-status">{note}</p> : null}
        <button
          type="button"
          className={listening ? "gel-btn talk-mic talk-mic-live" : "gel-btn talk-mic"}
          style={listening ? { transform: `scale(${1 + level * 0.12})` } : undefined}
          onClick={listening ? stop : start}
          disabled={phase === "searching"}
          aria-pressed={listening}
        >
          <span className="gel-label">
            {listening ? <Wave /> : null}
            {listening ? "Stop" : "Listen"}
          </span>
        </button>
      </div>
      <audio ref={audioRef} hidden />
    </div>
  );
}
