type AskBoxProps = {
  question: string;
  onQuestionChange: (value: string) => void;
  onSubmit: () => void;
};

export default function AskBox({
  question,
  onQuestionChange,
  onSubmit,
}: AskBoxProps) {
  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form className="ask-row" onSubmit={handleSubmit}>
      <input
        type="text"
        name="question"
        value={question}
        onChange={(e) => onQuestionChange(e.target.value)}
        placeholder="Ask what your town is deciding..."
        className="ask-input"
        aria-label="Ask what your town is deciding"
      />
      <button type="submit" className="gel-btn" disabled={!question.trim()}>
        <span className="gel-label">Ask</span>
      </button>
    </form>
  );
}
