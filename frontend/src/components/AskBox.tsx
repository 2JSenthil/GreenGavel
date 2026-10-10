type AskBoxProps = {
  question: string;
  onQuestionChange: (value: string) => void;
  onSubmit: () => void;
};

export default function AskBox( {
  question,
  onQuestionChange,
  onSubmit,
}: AskBoxProps) {
  
  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row"
    >
    <input
      type="text"
      value={question}
      onChange={(e) => onQuestionChange(e.target.value)}
      placeholder="Ask what your town is deciding..."
      className="flex-1 rounded-xl border border-gray-300 bg-white p-4 text-gray-900"
    />

      <button 
        type="submit"
        disabled={!question.trim()}
        className="rounded-xl bg-blue-500 px-8 py-4 font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Ask
      </button>
    </form>
  );
}