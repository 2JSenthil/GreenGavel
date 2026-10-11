"use client";

import { Leaf, Droplets, Bus, Sun } from "lucide-react";

const topics = [
  {
    id: "trees",
    label: "Trees and green space",
    question: "What is the town deciding about trees and green space?",
    Icon: Leaf,
  },
  {
    id: "water",
    label: "Stormwater and water",
    question: "What is the town deciding about stormwater and water?",
    Icon: Droplets,
  },
  {
    id: "transit",
    label: "Transit and biking",
    question: "What is the town deciding about transit and biking?",
    Icon: Bus,
  },
  {
    id: "energy",
    label: "Energy and climate",
    question: "What is the town deciding about energy and climate?",
    Icon: Sun,
  },
];

type TopicChipsProps = {
  onAsk: (question: string, topic: string) => void;
  busy?: boolean;
  className?: string;
};

export default function TopicChips({
  onAsk,
  busy = false,
  className = "",
}: TopicChipsProps) {
  return (
    <div
      className={["topic-grid", className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Environmental topics"
    >
      {topics.map(({ id, label, question, Icon }) => (
        <button
          key={id}
          type="button"
          className="gel-btn-light topic-chip"
          disabled={busy}
          onClick={() => onAsk(question, id)}
        >
          <span className="gel-label">
            <Icon aria-hidden="true" size={16} />
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
