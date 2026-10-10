"use client";

import { previewUrl, usePreview } from "./preview";

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
  const openPreview = usePreview();
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
        <button
          type="button"
          className="source-link"
          onClick={() =>
            openPreview({
              url: previewUrl(pdfUrl),
              title: body,
              draft: status === "draft",
            })
          }
        >
          Open PDF
        </button>
      ) : (
        <span className="source-link">PDF link coming soon</span>
      )}
    </article>
  );
}
