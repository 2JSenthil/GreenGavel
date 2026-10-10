"use client";

import AskBox from "@/components/AskBox";
import TopicChips from "@/components/TopicChips";
import AnswerPanel from "@/components/AnswerPanel";
import SourceCard from "@/components/SourceCard";
import FeedStrip from "@/components/FeedStrip";
import Desktop from "@/components/Desktop";

import { useState } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const handleQuestionChange = (value: string) => {
    setQuestion(value);
  };

  const handleToggleTopic = (topic: string) => {
    setSelectedTopic((previous) =>
      previous === topic ? null : topic
    );
  };

  const handleAsk = () => {
    if (!question.trim()) return;

    // Backend integration will go here later
    console.log("Question submitted:", question);
    console.log("Selected topic:", selectedTopic);
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
        <AnswerPanel />
        <div className="glass-panel" id="sources">
          <h2 className="window-bar">Sources</h2>
          <div className="panel-body source-list">
            <SourceCard number={1} body="Town Council" date="October 2026" page={12} />
            <SourceCard number={2} body="Planning Department" date="September 2026" page={8} />
            <SourceCard number={3} body="Environmental Committee" date="August 2026" page={4} />
          </div>
        </div>
      </section>

      <div id="meetings">
        <FeedStrip />
      </div>
    </Desktop>
  );
}
