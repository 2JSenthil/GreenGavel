const topics = [
  "Trees and green space",
  "Stormwater and water",
  "Transit and biking",
  "Energy and climate",
];

export default function TopicChips() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {topics.map((topic) => (
        <button
          key={topic}
          className="rounded-xl border border-blue-300 bg-white/70 p-3 text-sm text-gray-800"
        >
          {topic}
        </button>
      ))}
    </div>
  );
}