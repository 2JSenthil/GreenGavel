type SourceCardProps = {
  number: number;
  body: string;
  date: string;
  page: number;
  status?: "final" | "draft";
  pdfUrl?: string | null;
};

export default function SourceCard({
  number,
  body,
  date,
  page,
  status = "final",
  pdfUrl,
}: SourceCardProps) {
  return (
    <article className="glass-panel panel source-card">
      <h3>
        [{number}] {body}
        {status === "draft" ? <span className="draft-badge">Draft</span> : null}
      </h3>
      <p className="muted">
        {date} · Page {page}
      </p>
      {pdfUrl ? (
        <a className="source-link" href={pdfUrl} target="_blank" rel="noreferrer">
          Open PDF
        </a>
      ) : (
        <span className="source-link">PDF link coming soon</span>
      )}
    </article>
  );
}
