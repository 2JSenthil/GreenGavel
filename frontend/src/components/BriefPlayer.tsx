export default function BriefPlayer() {
  return (
    <div className="border-t border-gray-200 pt-4">
      <button
        disabled
        className="cursor-not-allowed rounded-xl bg-blue-500 px-6 py-3 font-semibold text-white opacity-60"
      >
        ▶ Play 60-second brief
      </button>
    </div>
  );
}