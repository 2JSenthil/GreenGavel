"use client";

import AskBox from "@/components/AskBox";
import TopicChips from "@/components/TopicChips";
import AnswerPanel from "@/components/AnswerPanel";
import SourceCard from "@/components/SourceCard";
import FeedStrip from "@/components/FeedStrip";

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
    <main className="min-h-screen bg-gradient-to-b from-sky-200 to-green-100 p-6 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header */}
        <header className="py-4">
          <h1 className="text-4xl font-bold text-green-800">
            Green Gavel
          </h1>
          <p className="mt-2 text-gray-700">
            Understand what your town is deciding.
          </p>
        </header>

        {/* Question and Topics */}
        <section className="space-y-4">
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

        {/* Answer and Sources */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-5">

          <div className="md:col-span-3">
            <AnswerPanel />
          </div>

          <div className="space-y-4 rounded-2xl border border-blue-200 bg-white/80 p-6 md:col-span-2">
            <h2 className="text-xl font-bold">
              Sources
            </h2>

            {/* mock data for sources */}
            <SourceCard
              number={1}
              body="Town Council"
              date="October 2026"
              page={12}
            />

            <SourceCard
              number={2}
              body="Planning Department"
              date="September 2026"
              page={8}
            />

            <SourceCard
              number={3}
              body="Environmental Committee"
              date="August 2026"
              page={4}
            />
          </div>
        </section>

        {/* Upcoming Meetings */}
        <FeedStrip />

      </div>
    </main>
  );
}