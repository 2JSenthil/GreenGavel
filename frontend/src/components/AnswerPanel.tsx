type SourceItem = {
  id: number;
  body: string;
  date: string;
  page: number;
  pdf_url?: string | null;
  is_draft?: boolean;
};

type AnswerPanelProps = {
  answer: string;
  loading?: boolean;
  error?: string;
  sources?: SourceItem[];
};

export default function AnswerPanel({
  answer,
  loading = false,
  error,
  sources = [],
}: AnswerPanelProps) {
  const displayText = error || answer || "Ask a question to learn what your town council is deciding about environmental issues.";

  return (
    <div className="glass-panel answer-panel">
      <h2 className="window-bar window-green">Answer</h2>
      <div className="panel-body">
        <p className="answer-copy" aria-live="polite">
          {loading ? "Searching the records..." : displayText}
        </p>
        {sources.length > 0 ? (
          <div className="source-list compact">
            {sources.slice(0, 3).map((source) => (
              <div key={source.id} className="source-mini">
                <strong>{source.body}</strong>
                <span>{source.date}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
