"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfSheetProps = {
  url: string;
  title: string;
};

function PageCanvas({
  doc,
  pageNumber,
  zoom,
  title,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  title: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;

    (async () => {
      const pdfPage = await doc.getPage(pageNumber);
      if (cancelled) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = pdfPage.getViewport({ scale: zoom * ratio });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / ratio}px`;
      canvas.style.height = `${viewport.height / ratio}px`;
      task = pdfPage.render({ canvas, viewport });
      await task.promise;
    })().catch((error: unknown) => {
      if (error instanceof Error && error.name === "RenderingCancelledException") return;
    });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, zoom]);

  return (
    <div className="sheet-paper" id={`sheet-page-${pageNumber}`}>
      <canvas ref={ref} aria-label={`${title}, page ${pageNumber}`} />
    </div>
  );
}

export default function PdfSheet({ url, title }: PdfSheetProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [note, setNote] = useState("Opening the file...");

  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void>; promise: Promise<PDFDocumentProxy> } | null = null;
    setDoc(null);
    setPages(0);
    setPage(1);
    setNote("Opening the file...");

    (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("pdf failed");
      const data = new Uint8Array(await response.arrayBuffer());
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      task = pdfjs.getDocument({ data });
      const loaded = await task.promise;
      if (cancelled) return;
      const first = await loaded.getPage(1);
      const natural = first.getViewport({ scale: 1 }).width;
      const room = Math.max(240, (stageRef.current?.clientWidth ?? 520) - 48);
      setZoom(Math.min(1.35, Math.max(0.7, room / natural)));
      setDoc(loaded);
      setPages(loaded.numPages);
      setNote("");
    })().catch(() => {
      if (!cancelled) setNote("This PDF could not be opened.");
    });

    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || pages === 0) return;
    const onScroll = () => {
      const edge = stage.getBoundingClientRect().top + 48;
      let current = 1;
      for (let number = 1; number <= pages; number += 1) {
        const sheet = document.getElementById(`sheet-page-${number}`);
        if (!sheet) continue;
        if (sheet.getBoundingClientRect().top <= edge) current = number;
      }
      setPage(current);
    };
    stage.addEventListener("scroll", onScroll, { passive: true });
    return () => stage.removeEventListener("scroll", onScroll);
  }, [pages]);

  function jump(next: number) {
    const pageNumber = Math.min(pages, Math.max(1, next));
    setPage(pageNumber);
    document.getElementById(`sheet-page-${pageNumber}`)?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="sheet-view">
      <div className="sheet-toolbar">
        <button type="button" className="explorer-nav" aria-label="Previous page" disabled={page <= 1 || pages === 0} onClick={() => jump(page - 1)}>
          <span className="gel-label">‹</span>
        </button>
        <p className="sheet-count">{pages === 0 ? "Page" : `Page ${page} of ${pages}`}</p>
        <button type="button" className="explorer-nav" aria-label="Next page" disabled={page >= pages || pages === 0} onClick={() => jump(page + 1)}>
          <span className="gel-label">›</span>
        </button>
        <button type="button" className="explorer-nav" aria-label="Zoom out" disabled={pages === 0} onClick={() => setZoom((current) => Math.max(0.6, Number((current - 0.2).toFixed(2))))}>
          <span className="gel-label">−</span>
        </button>
        <button type="button" className="explorer-nav" aria-label="Zoom in" disabled={pages === 0} onClick={() => setZoom((current) => Math.min(2.2, Number((current + 0.2).toFixed(2))))}>
          <span className="gel-label">+</span>
        </button>
        <p className="sheet-title">{title}</p>
      </div>
      <div className="sheet-stage" ref={stageRef}>
        {note ? <p className="explorer-note">{note}</p> : null}
        {doc && pages > 0 ? (
          <div className="sheet-stack">
            {Array.from({ length: pages }, (_, index) => (
              <PageCanvas key={`${url}-${index + 1}`} doc={doc} pageNumber={index + 1} zoom={zoom} title={title} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
