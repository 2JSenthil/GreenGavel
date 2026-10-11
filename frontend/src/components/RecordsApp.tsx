"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useBusy } from "./busyCursor";
import { play } from "./sounds";
import { previewUrl, usePreview } from "./preview";

const API = "";

type RecordDocument = {
  id: string;
  event_id: number;
  title: string;
  item_title: string;
  kind: string;
  body: string;
  date: string;
  time: string;
  status: string;
  is_draft: boolean;
  is_pdf: boolean;
  file_url: string;
};

type MeetingGroup = {
  eventId: number;
  body: string;
  date: string;
  time: string;
  documents: RecordDocument[];
};

type Place = {
  folder: number | null;
  file: string | null;
};

function groupDocuments(documents: RecordDocument[]): MeetingGroup[] {
  const groups: MeetingGroup[] = [];
  for (const document of documents) {
    const current = groups[groups.length - 1];
    if (current && current.eventId === document.event_id) {
      current.documents.push(document);
      continue;
    }
    groups.push({
      eventId: document.event_id,
      body: document.body,
      date: document.date,
      time: document.time,
      documents: [document],
    });
  }
  return groups;
}

function kindLabel(kind: string) {
  if (kind === "agenda") return "Agenda";
  if (kind === "minutes") return "Minutes";
  return "Attachment";
}

function FileRow({
  document,
  index,
  selected,
  onOpen,
  onPreview,
}: {
  document: RecordDocument;
  index: number;
  selected: boolean;
  onOpen: () => void;
  onPreview: () => void;
}) {
  const label = document.item_title ? `${document.title}. ${document.item_title}` : document.title;
  return (
    <button
      type="button"
      className={selected ? "explorer-row explorer-on" : index % 2 === 1 ? "explorer-row explorer-row-alt" : "explorer-row"}
      aria-pressed={selected}
      title={`${label}. Double-click to open in Preview.`}
      onClick={onOpen}
      onDoubleClick={onPreview}
    >
      <span className="explorer-name">
        <img src="/aero/icons/file.png" alt="" width={16} height={16} />
        <span className="explorer-line">{document.title}</span>
        {document.is_draft ? <span className="draft-badge">Draft</span> : null}
      </span>
      <span className="explorer-line">{kindLabel(document.kind)}</span>
      <span className="explorer-line">{document.date}</span>
    </button>
  );
}

export default function RecordsApp() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [request, setRequest] = useState(0);
  const [documents, setDocuments] = useState<RecordDocument[]>([]);
  const [loading, setLoading] = useState(true);
  useBusy(loading);
  const [note, setNote] = useState("");
  const [trail, setTrail] = useState<Place[]>([{ folder: null, file: null }]);
  const [index, setIndex] = useState(0);
  const place = trail[index] ?? { folder: null, file: null };
  const openPreview = usePreview();

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (submitted) params.set("q", submitted);
    setLoading(true);
    setNote("");
    fetch(`${API}/api/records?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("records failed");
        return (await response.json()) as { documents?: RecordDocument[] };
      })
      .then((body) => {
        const next = body.documents ?? [];
        setDocuments(next);
        setTrail([{ folder: null, file: null }]);
        setIndex(0);
        if (next.length === 0) {
          setNote(submitted ? "No records match that search." : "No records are posted yet.");
          play("exclamation");
        } else if (submitted) {
          play("notify");
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDocuments([]);
        setTrail([{ folder: null, file: null }]);
        setIndex(0);
        setNote("Records are unavailable right now.");
        play("critical");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [submitted, request]);

  const groups = useMemo(() => groupDocuments(documents), [documents]);
  const folder = groups.find((group) => group.eventId === place.folder) ?? null;
  const files = folder ? folder.documents : documents;
  const selected = documents.find((document) => document.id === place.file) ?? null;

  function go(next: Place) {
    if (next.folder === place.folder && next.file === place.file) return;
    setTrail((current) => [...current.slice(0, index + 1), next]);
    setIndex((current) => current + 1);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    play("menu");
    setLoading(true);
    setSubmitted(query.trim());
    setRequest((current) => current + 1);
  }

  const folderCrumb = folder ? `${folder.body} ${folder.date}` : submitted ? "Search results" : "All meetings";

  return (
    <div className="explorer">
      <div className="explorer-command">
        <button type="button" className="explorer-nav" aria-label="Back" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}>
          <span className="gel-label">←</span>
        </button>
        <button type="button" className="explorer-nav" aria-label="Forward" disabled={index >= trail.length - 1} onClick={() => setIndex((current) => Math.min(trail.length - 1, current + 1))}>
          <span className="gel-label">→</span>
        </button>
        <button
          type="button"
          className="explorer-nav"
          aria-label="Up"
          disabled={place.folder === null && place.file === null}
          onClick={() => go(place.file ? { folder: place.folder, file: null } : { folder: null, file: null })}
        >
          <span className="gel-label">↑</span>
        </button>
      </div>

      <div className="explorer-address">
        <nav className="explorer-crumbs" aria-label="Address">
          <button type="button" onClick={() => go({ folder: null, file: null })}>
            Records
          </button>
          <span aria-hidden="true">›</span>
          <button type="button" onClick={() => go({ folder: place.folder, file: null })} disabled={place.folder === null && !submitted}>
            {folderCrumb}
          </button>
          {selected ? (
            <>
              <span aria-hidden="true">›</span>
              <span className="explorer-crumb-file">{selected.title}</span>
            </>
          ) : null}
        </nav>
        <form className="explorer-search" onSubmit={onSubmit}>
          <label className="explorer-sr" htmlFor="records-query">
            Search records
          </label>
          <input
            id="records-query"
            value={query}
            placeholder="Search"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" className="gel-btn explorer-search-btn" data-sound="none">
            <span className="gel-label">Search</span>
          </button>
        </form>
      </div>

      <div className="explorer-panes">
        <section className="explorer-pane" aria-label="Folders">
          <h3 className="explorer-pane-head">Folders</h3>
          <div className="explorer-pane-body">
            <button
              type="button"
              className={place.folder === null ? "explorer-folder explorer-on" : "explorer-folder"}
              aria-pressed={place.folder === null}
              onClick={() => go({ folder: null, file: null })}
            >
              <span className="explorer-folder-icon" aria-hidden="true" />
              {submitted ? "Search results" : "All meetings"}
            </button>
            {groups.map((group) => (
              <button
                key={group.eventId}
                type="button"
                className={place.folder === group.eventId ? "explorer-folder explorer-on" : "explorer-folder"}
                aria-pressed={place.folder === group.eventId}
                onClick={() => go({ folder: group.eventId, file: null })}
              >
                <span className="explorer-folder-icon" aria-hidden="true" />
                <span>
                  {group.body}
                  <small>
                    {group.date}
                    {group.time ? ` ${group.time}` : ""}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="explorer-pane" aria-label="Files">
          <h3 className="explorer-pane-head">Files</h3>
          <div className="explorer-pane-body explorer-files" aria-live="polite">
            <div className="explorer-columns" aria-hidden="true">
              <span>Name</span>
              <span>Type</span>
              <span>Date</span>
            </div>
            {loading ? <p className="explorer-note">Loading records...</p> : null}
            {!loading && note ? <p className="explorer-note">{note}</p> : null}
            {files.map((document, fileIndex) => (
              <FileRow
                key={`${document.event_id}-${document.id}-${fileIndex}`}
                document={document}
                index={fileIndex}
                selected={selected?.id === document.id}
                onOpen={() => go({ folder: document.event_id, file: document.id })}
                onPreview={() => {
                  openPreview({
                    url: previewUrl(document.file_url),
                    title: document.title,
                    draft: document.is_draft,
                  });
                }}
              />
            ))}
          </div>
        </section>
      </div>

      <footer className="explorer-status">
        <span>{loading ? "Looking up records..." : `${files.length} ${files.length === 1 ? "item" : "items"}`}</span>
        <span>{selected ? selected.title : folderCrumb}</span>
      </footer>
    </div>
  );
}
