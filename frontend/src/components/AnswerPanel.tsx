export default function AnswerPanel() {
  return (
    <div className="glass-panel answer-panel">
      <h2 className="window-bar window-green">Answer</h2>
      <div className="panel-body">
        <p className="answer-copy" aria-live="polite">
          Ask a question to learn what your town council is deciding about environmental issues.
        </p>
      </div>
    </div>
  );
}
