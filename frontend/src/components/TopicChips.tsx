const topics = [
  "Trees and green space",
  "Stormwater and water",
  "Transit and biking",
  "Energy and climate",
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
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
      role="group"
      aria-label="Environmental topics">
      {topics.map((topic) => {
        const isSelected = selectedTopic === topic;
        return (
        <button
          key={topic}
          type="button"
          aria-pressed={isSelected}
          onClick={() => onToggleTopic(topic)}
          className={`rounded-xl border p-3 text-sm transition ${
              isSelected
                ? "border-blue-500 bg-blue-500 font-semibold text-white"
                : "border-blue-300 bg-white/70 text-gray-800 hover:bg-blue-100"
            }`}
        >
          {topic}
        </button>
      );
    })}
    </div>
  );
}