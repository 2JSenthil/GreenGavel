"use client";

import { previewUrl, usePreview } from "./preview";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type SourceCardProps = {
  body: string;
  date?: string;
  status?: "final" | "draft";
  pdfUrl?: string | null;
};

export function uniqueSources<T extends { pdf_url?: string | null; id?: number }>(sources: T[]) {
  const seen = new Set<string>();
  return sources.filter((source, index) => {
    const key = source.pdf_url || `missing-${source.id ?? index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceDate(value: string | undefined, pdfUrl?: string | null) {
  const iso = (value || "").slice(0, 10);
  const fromName = (pdfUrl || "").match(/_(\d{2})-(\d{2})-(\d{2})_/);
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso
    : fromName
      ? `20${fromName[1]}-${fromName[2]}-${fromName[3]}`
      : "";
  if (!raw) return "";
  const [year, month, day] = raw.split("-").map(Number);
  const label = MONTHS[month - 1];
  if (!label || !day || !year) return raw;
  return `${label} ${day}, ${year}`;
}

function sourceName(pdfUrl: string | null | undefined, fallback: string) {
  const file = decodeURIComponent((pdfUrl ?? "").split("?")[0].split("/").pop() || "");
  const stem = file.replace(/\.pdf$/i, "");
  const titled = stem.match(/^\d+_[A-Za-z]_.+?_\d{2}-\d{2}-\d{2}_(.+)$/);
  const raw = (titled?.[1] || stem || fallback).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) return "Record";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function SourceCard({
  body,
  date,
  status = "final",
  pdfUrl,
}: SourceCardProps) {
  const openPreview = usePreview();
  const name = sourceName(pdfUrl, body);
  const when = sourceDate(date, pdfUrl);
  const label = when ? `${name}, ${when}` : name;

  function open() {
    if (!pdfUrl) return;
    openPreview({
      url: previewUrl(pdfUrl),
      title: label,
      draft: status === "draft",
    });
  }

  const text = (
    <>
      <span className="source-name">{name}</span>
      {when ? <span className="source-when">{when}</span> : null}
    </>
  );

  return (
    <article className="source-line">
      {pdfUrl ? (
        <button type="button" className="source-link" onClick={open} title={label}>
          {text}
        </button>
      ) : (
        <span className="source-line-text" title={label}>
          {text}
        </span>
      )}
      {status === "draft" ? <span className="draft-badge">Draft</span> : null}
    </article>
  );
}
