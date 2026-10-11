import { play } from "./sounds";

type AskBoxProps = {
  question: string;
  onQuestionChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  busy?: boolean;
};

export default function AskBox({
  question,
  onQuestionChange,
  onSubmit,
  onStop,
  busy = false,
}: AskBoxProps) {
  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!busy && question.trim()) play("menu");
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
      {busy ? (
        <button type="button" className="gel-btn" onClick={onStop}>
          <span className="gel-label">Stop</span>
        </button>
      ) : (
        <button type="submit" className="gel-btn" data-sound="none" disabled={!question.trim()}>
          <span className="gel-label">Ask</span>
        </button>
      )}
    </form>
  );
}
