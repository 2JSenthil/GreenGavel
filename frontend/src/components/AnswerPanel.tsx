import BriefPlayer from "./BriefPlayer";

export default function AnswerPanel() {
  return (
    <div className="flex min-h-80 flex-col rounded-2xl border border-blue-300 bg-white/80 p-6">
      <h2 className="mb-4 text-xl font-bold">
        Answer
      </h2>

      <p className="text-gray-700">
        Ask a question to learn what your town council
        is deciding about environmental issues.
      </p>

      <div className="mt-auto pt-8">
        <BriefPlayer />
      </div>
    </div>
  );
}