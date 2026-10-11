"use client";

import AskBox from "@/components/AskBox";
import TopicChips from "@/components/TopicChips";
import SourceCard, { uniqueSources } from "@/components/SourceCard";
import Desktop from "@/components/Desktop";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type SourceItem = {
  id: number;
  body: string;
  date: string;
  page: number;
  pdf_url?: string | null;
  is_draft?: boolean;
  document_name?: string;
};

function plainText(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*\*\s+/gm, "");
}

type Turn = {
  id: number;
  question: string;
  answer: string;
  sources: SourceItem[];
  pending: boolean;
  error: string;
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const turnId = useRef(0);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }, [turns]);

  function patchTurn(id: number, patch: Partial<Turn>) {
    setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));
  }

  const handleQuestionChange = (value: string) => {
    setQuestion(value);
  };

  const handleAsk = async (asked: string, topic?: string) => {
    const text = asked.trim();
    if (!text || loading) return;

    const id = turnId.current + 1;
    turnId.current = id;
    setQuestion("");
    setLoading(true);
    setTurns((current) => [
      ...current,
      { id, question: text, answer: "", sources: [], pending: true, error: "" },
    ]);

    try {
      const response = await fetch(`${API}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          topic,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Backend request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let nextText = "";
      let nextSources: SourceItem[] = [];
      let error = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          let event = "";
          let payloadText = "";

          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) {
              event = line.replace("event:", "").trim();
            }
            if (line.startsWith("data:")) {
              payloadText += line.replace("data:", "").trim();
            }
          }

          if (!event || !payloadText) continue;

          const payload = JSON.parse(payloadText) as {
            text?: string;
            sources?: SourceItem[];
            message?: string;
          };

          if (event === "delta") {
            nextText += payload.text ?? "";
            patchTurn(id, { answer: nextText });
          }

          if (event === "sources") {
            nextSources = payload.sources ?? [];
            patchTurn(id, { sources: nextSources });
          }

          if (event === "error") {
            error = payload.message ?? "Unable to generate an answer.";
            patchTurn(id, { error });
          }
        }
      }

      patchTurn(id, {
        answer: nextText || (error ? "" : "The records I have don't say."),
        sources: nextSources,
        pending: false,
        error,
      });
    } catch (fetchError) {
      console.error(fetchError);
      patchTurn(id, {
        pending: false,
        error: "Unable to connect to the backend right now.",
      });
    } finally {
      setLoading(false);
    }
  };

  const latest = turns[turns.length - 1];
  const shownSources = uniqueSources(latest?.sources ?? []);

  return (
    <Desktop>
      <section className="split">
        <div className="glass-panel chat-panel">
          <div className="chat-log" ref={logRef} aria-live="polite" aria-busy={loading}>
            {turns.length === 0 ? (
              <div className="chat-row chat-row-gavel">
                <p className="chat-bubble chat-bubble-gavel">
                  Ask a question to learn what your town council is deciding about environmental issues.
                </p>
              </div>
            ) : null}
            {turns.map((turn) => (
              <div className="chat-exchange" key={turn.id}>
                <div className="chat-row chat-row-user">
                  <p className="chat-bubble chat-bubble-user">{turn.question}</p>
                </div>
                <div className="chat-row chat-row-gavel">
                  {turn.pending && !turn.answer && !turn.error ? (
                    <p className="chat-bubble chat-bubble-gavel chat-typing" aria-label="Searching the records">
                      <span />
                      <span />
                      <span />
                    </p>
                  ) : (
                    <p className="chat-bubble chat-bubble-gavel">
                      {plainText(turn.error || turn.answer)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="chat-composer">
            <TopicChips
              className="chat-topics"
              busy={loading}
              onAsk={handleAsk}
            />
            <AskBox
              question={question}
              onQuestionChange={handleQuestionChange}
              onSubmit={() => handleAsk(question)}
              busy={loading}
            />
          </div>
        </div>
        <div className="glass-panel" id="sources">
          <h2 className="window-bar">Sources</h2>
          <div className="panel-body source-list">
            {shownSources.length > 0 ? (
              shownSources.map((source, index) => (
                <SourceCard
                  key={`${source.id ?? source.body}-${index}`}
                  body={source.body}
                  date={source.date}
                  status={source.is_draft ? "draft" : "final"}
                  pdfUrl={source.pdf_url ?? null}
                />
              ))
            ) : (
              <p className="muted">Answer sources will appear here.</p>
            )}
          </div>
        </div>
      </section>
    </Desktop>
  );
}
