"use client";

import { Leaf, Droplets, Bus, Sun } from "lucide-react";

const topics = [
  { id: "trees", label: "Trees and green space", Icon: Leaf },
  { id: "water", label: "Stormwater and water", Icon: Droplets },
  { id: "transit", label: "Transit and biking", Icon: Bus },
  { id: "energy", label: "Energy and climate", Icon: Sun },
];

type TopicChipsProps = {
  selectedTopic: string | null;
  onToggleTopic: (topic: string) => void;
};

export default function TopicChips({
  selectedTopic,
  onToggleTopic,
}: TopicChipsProps) {
  return (
    <div
      className="topic-grid"
      role="group"
      aria-label="Environmental topics"
    >
      {topics.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="gel-btn-light topic-chip"
          aria-pressed={selectedTopic === id}
          onClick={() => onToggleTopic(id)}
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
