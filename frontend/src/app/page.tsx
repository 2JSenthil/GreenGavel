"use client";

import AskBox from "@/components/AskBox";
import TopicChips from "@/components/TopicChips";
import AnswerPanel from "@/components/AnswerPanel";
import SourceCard from "@/components/SourceCard";
import FeedStrip from "@/components/FeedStrip";
import Desktop from "@/components/Desktop";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SourceItem = {
  id: number;
  body: string;
  date: string;
  page: number;
  pdf_url?: string | null;
  is_draft?: boolean;
  document_name?: string;
};

type MeetingItem = {
  id?: string;
  title?: string;
  body?: string;
  date?: string;
  time?: string;
  agenda_pdf?: string;
  agenda_url?: string;
  meeting_url?: string;
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadFeed() {
      try {
        const response = await fetch(`${API}/api/feed?days=14`);
        if (!response.ok) return;
        const data = await response.json();
        setMeetings(data.meetings ?? []);
      } catch {
        setMeetings([]);
      }
    }

    loadFeed();
  }, []);

  const handleQuestionChange = (value: string) => {
    setQuestion(value);
  };

  const handleToggleTopic = (topic: string) => {
    setSelectedTopic((previous) =>
      previous === topic ? null : topic
    );
  };

  const handleAsk = async () => {
    if (!question.trim()) return;

    setLoading(true);
    setError("");
    setAnswer("");
    setSources([]);

    try {
      const response = await fetch(`${API}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          topic: selectedTopic ?? undefined,
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
            setAnswer(nextText);
          }

          if (event === "sources") {
            nextSources = payload.sources ?? [];
            setSources(nextSources);
          }

          if (event === "error") {
            setError(payload.message ?? "Unable to generate an answer.");
          }
        }
      }

      setAnswer(nextText || "The records I have don't say.");
      setSources(nextSources);
    } catch (fetchError) {
      console.error(fetchError);
      setError("Unable to connect to the backend right now.");
      setAnswer("The records I have don't say.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Desktop>
      <section className="ask-block">
        <AskBox
          question={question}
          onQuestionChange={handleQuestionChange}
          onSubmit={handleAsk}
        />
        <TopicChips
          selectedTopic={selectedTopic}
          onToggleTopic={handleToggleTopic}
        />
      </section>

      <section className="split">
        <AnswerPanel
          answer={answer}
          loading={loading}
          error={error}
          sources={sources}
        />
        <div className="glass-panel" id="sources">
          <h2 className="window-bar">Sources</h2>
          <div className="panel-body source-list">
            {sources.length > 0 ? (
              sources.map((source, index) => (
                <SourceCard
                  key={`${source.id ?? source.body}-${index}`}
                  number={index + 1}
                  body={source.body}
                  date={source.date}
                  page={source.page}
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

      <div id="meetings">
        <FeedStrip meetings={meetings} />
      </div>
    </Desktop>
  );
}
