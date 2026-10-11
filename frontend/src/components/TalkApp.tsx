"use client";

import { useEffect, useRef, useState } from "react";
import { useBusy } from "./busyCursor";
import RichText from "./RichText";
import { play } from "./sounds";
import SourceCard, { uniqueSources } from "./SourceCard";

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

type BrowserSpeech = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
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
  useBusy(phase === "searching");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [audioUrl, setAudioUrl] = useState("");
  const [note, setNote] = useState("");
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const recordingRef = useRef<Recording | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelRef = useRef(false);
  const ignoreAudioError = useRef(false);
  const recognitionRef = useRef<BrowserSpeech | null>(null);
  const transcriptRef = useRef("");
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
      recognitionRef.current?.stop();
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
    audio.play().catch(() => {
      setNote("Audio unavailable.");
      play("exclamation");
    });
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
      play("exclamation");
      return;
    }

    if (cancelRef.current) {
      patchTurn(turnId, { pending: false });
      setPhase("ready");
      return;
    }
    setPhase("searching");
    setNote("");
    setSpeaking(false);
    audioRef.current?.pause();
    setAudioUrl("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${API}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, voice: true }),
        signal: controller.signal,
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
        play("critical");
        setPhase("idle");
        return;
      }

      patchTurn(turnId, { answer: text, sources: nextSources, pending: false });
      if (text.trim() === REFUSAL) {
        setPhase("ready");
        play("ding");
        return;
      }

      setAudioUrl(`${API}/api/brief/stream/${answerId}`);
      setPhase("ready");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        patchTurn(turnId, { pending: false });
        setPhase("ready");
        return;
      }
      patchTurn(turnId, { pending: false });
      setNote("Unable to answer.");
      play("critical");
      setPhase("idle");
    }
  }

  function stopOutput() {
    cancelRef.current = true;
    ignoreAudioError.current = true;
    abortRef.current?.abort();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setAudioUrl("");
    setSpeaking(false);
    setTurns((current) => current.map((turn) => (turn.pending ? { ...turn, pending: false } : turn)));
    setPhase("ready");
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNote("This browser cannot hear you. Use Chrome.");
      play("exclamation");
      return;
    }
    transcriptRef.current = "";
    recognitionRef.current = startRecognition();
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
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setPhase("idle");
      setNote("Microphone access was blocked.");
      play("exclamation");
    }
  }

  async function stop() {
    const recording = recordingRef.current;
    if (!recording || recording.recorder.state === "inactive") {
      setPhase("idle");
      setNote("I didn't hear a question.");
      play("exclamation");
      return;
    }
    cancelRef.current = false;
    setPhase("searching");
    setNote("");
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        recognition.onend = finish;
        try {
          recognition.stop();
        } catch {
          finish();
        }
        window.setTimeout(finish, 1200);
      });
    }
    const heard = transcriptRef.current.trim();
    recording.recorder.onstop = () => {
      stopMeter();
      recording.stream.getTracks().forEach((track) => track.stop());
      recordingRef.current = null;
      if (heard) return;
      const blob = new Blob(recording.chunks, { type: recording.recorder.mimeType || "audio/webm" });
      void transcribe(blob);
    };
    recording.recorder.stop();
    if (cancelRef.current || !heard) return;
    const turnId = turnIdRef.current++;
    setTurns((current) => [
      ...current,
      { id: turnId, question: heard, answer: "", sources: [], sourcesOpen: false, kind: "", pending: true },
    ]);
    void ask(heard, turnId);
  }

  function startRecognition() {
    const host = window as Window & {
      SpeechRecognition?: new () => BrowserSpeech;
      webkitSpeechRecognition?: new () => BrowserSpeech;
    };
    const SpeechRecognition = host.SpeechRecognition ?? host.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onend = null;
    recognition.onresult = (event) => {
      let spoken = "";
      for (let index = 0; index < event.results.length; index += 1) {
        spoken += event.results[index][0]?.transcript ?? "";
      }
      transcriptRef.current = spoken.trim();
    };
    try {
      recognition.start();
    } catch {
      return null;
    }
    return recognition;
  }

  async function transcribe(blob: Blob) {
    if (blob.size < 200) {
      setPhase("idle");
      setNote("I didn't hear a question.");
      play("exclamation");
      return;
    }
    setPhase("searching");
    setNote("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const form = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      form.append("file", blob, `question.${extension}`);
      const response = await fetch(`${API}/api/transcribe`, { method: "POST", body: form, signal: controller.signal });
      const body = (await response.json()) as { text?: string };
      if (!response.ok) {
        setPhase("idle");
        setNote("Could not transcribe that. Try again.");
        play("exclamation");
        return;
      }
      const spoken = (body.text ?? "").trim();
      if (cancelRef.current) return;
      if (!spoken) {
        setPhase("idle");
        setNote("I didn't hear a question.");
        play("exclamation");
        return;
      }
      const turnId = turnIdRef.current++;
      setTurns((current) => [
        ...current,
        { id: turnId, question: spoken, answer: "", sources: [], sourcesOpen: false, kind: "", pending: true },
      ]);
      await ask(spoken, turnId);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setPhase("ready");
        return;
      }
      setPhase("idle");
      setNote("Could not transcribe that. Try again.");
      play("exclamation");
    }
  }

  const listening = phase === "listening";
  const outputLive = phase === "searching" || speaking;
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
                  <div className="talk-bubble talk-bubble-gavel">
                    {turn.answer ? (
                      <RichText text={turn.answer} />
                    ) : turn.kind === "records" ? (
                      "Searching the records..."
                    ) : (
                      "One moment..."
                    )}
                  </div>
                  {turn.sources.length > 0 ? (
                    <>
                      <button
                        type="button"
                        className="gel-btn-light talk-sources-btn"
                        aria-expanded={turn.sourcesOpen}
                        onClick={() => patchTurn(turn.id, { sourcesOpen: !turn.sourcesOpen })}
                      >
                        <span className="gel-label">
                          {uniqueSources(turn.sources).length === 1
                            ? "1 source"
                            : `${uniqueSources(turn.sources).length} sources`}
                        </span>
                      </button>
                      {turn.sourcesOpen ? (
                        <div className="source-list talk-sources">
                          {uniqueSources(turn.sources).map((source) => (
                            <SourceCard
                              key={source.id}
                              body={source.body}
                              date={source.date}
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
          onClick={listening ? stop : outputLive ? stopOutput : start}
          aria-pressed={listening || outputLive}
        >
          <span className="gel-label">
            {listening ? <Wave /> : null}
            {listening || outputLive ? "Stop" : "Listen"}
          </span>
        </button>
      </div>
      <audio
        ref={audioRef}
        hidden
        onPlay={() => setSpeaking(true)}
        onEnded={() => setSpeaking(false)}
        onPause={() => setSpeaking(false)}
        onError={(event) => {
          if (ignoreAudioError.current) {
            ignoreAudioError.current = false;
            return;
          }
          const audio = event.currentTarget;
          if (!audioUrl || audio.error?.code === 1) return;
          setSpeaking(false);
          setNote("Audio unavailable.");
          play("exclamation");
        }}
      />
    </div>
  );
}
