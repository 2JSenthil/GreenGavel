export default function AskBox() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <input
        type="text"
        placeholder="Ask what your town is deciding..."
        className="flex-1 rounded-xl border border-gray-300 bg-white p-4 text-gray-900"
      />

      <button className="rounded-xl bg-blue-500 px-8 py-4 font-semibold text-white">
        Ask
      </button>
    </div>
  );
}