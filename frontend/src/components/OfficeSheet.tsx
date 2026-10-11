"use client";

import { useEffect, useState } from "react";
import { useBusy } from "./busyCursor";
import { play } from "./sounds";
import { previewKind, type PreviewKind } from "./preview";

type OfficePage = { label: string; html: string };

type MammothModule = {
  convertToHtml?: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  default?: MammothModule;
};

const DRAWING = "http://schemas.openxmlformats.org/drawingml/2006/main";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cleanHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function readU32(data: Uint8Array, offset: number) {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

function pieceText(word: Uint8Array, table: Uint8Array) {
  let best = "";
  let bestScore = 0;
  for (let index = 0; index < table.length - 8; index += 1) {
    if (table[index] !== 2) continue;
    const length = readU32(table, index + 1);
    if (length % 12 !== 4 || length < 16 || index + 5 + length > table.length) continue;
    const count = (length - 4) / 12;
    if (count < 1 || count > 64) continue;
    const base = index + 5;
    const positions: number[] = [];
    let ordered = true;
    for (let piece = 0; piece <= count; piece += 1) {
      const position = readU32(table, base + piece * 4);
      if (piece > 0 && position < positions[piece - 1]) ordered = false;
      positions.push(position);
    }
    if (!ordered || positions[0] !== 0) continue;
    const pieces = base + (count + 1) * 4;
    let text = "";
    let usable = true;
    for (let piece = 0; piece < count; piece += 1) {
      const raw = readU32(table, pieces + piece * 8 + 2);
      const compressed = (raw & 0x40000000) !== 0;
      const offset = compressed ? Math.floor((raw & 0x3fffffff) / 2) : raw & 0x3fffffff;
      const chars = positions[piece + 1] - positions[piece];
      if (chars < 0 || chars > 100000 || offset >= word.length) {
        usable = false;
        break;
      }
      for (let charIndex = 0; charIndex < chars; charIndex += 1) {
        let code = 0;
        if (compressed) {
          if (offset + charIndex >= word.length) break;
          code = word[offset + charIndex];
        } else {
          const point = offset + charIndex * 2;
          if (point + 1 >= word.length) break;
          code = word[point] | (word[point + 1] << 8);
        }
        if (code === 13 || code === 7) text += "\n";
        else if (code === 9 || code === 11) text += " ";
        else if (code >= 32 && code !== 127) text += String.fromCharCode(code);
      }
    }
    if (!usable) continue;
    const score = text.match(/\b(the|of|and|to|shall|board|member|town)\b/gi)?.length ?? 0;
    if (score > bestScore) {
      best = text;
      bestScore = score;
    }
  }
  if (bestScore < 3) return "";
  return best.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 20000);
}

async function renderDoc(buffer: ArrayBuffer): Promise<OfficePage[]> {
  const CFB = await import("cfb");
  const book = CFB.read(new Uint8Array(buffer), { type: "array" });
  const wordEntry = CFB.find(book, "WordDocument");
  const tableEntry = CFB.find(book, "1Table") ?? CFB.find(book, "0Table");
  if (!wordEntry?.content || !tableEntry?.content) return [];
  const text = pieceText(Uint8Array.from(wordEntry.content), Uint8Array.from(tableEntry.content));
  const html = paragraphs(text);
  return html ? [{ label: "Document", html }] : [];
}

async function renderDocx(buffer: ArrayBuffer): Promise<OfficePage[]> {
  const mod = (await import("mammoth")) as MammothModule;
  const convert = mod.convertToHtml ?? mod.default?.convertToHtml;
  if (!convert) throw new Error("docx");
  const result = await convert({ arrayBuffer: buffer });
  const html = cleanHtml(result.value || "");
  if (!html.trim()) return [];
  return [{ label: "Document", html }];
}

async function renderXlsx(buffer: ArrayBuffer): Promise<OfficePage[]> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(buffer, { type: "array" });
  return book.SheetNames.map((name, index) => ({
    label: name || `Sheet ${index + 1}`,
    html: cleanHtml(XLSX.utils.sheet_to_html(book.Sheets[name] ?? {})),
  })).filter((page) => page.html.trim());
}

async function renderPptx(buffer: ArrayBuffer): Promise<OfficePage[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => {
      const leftNumber = Number(left.match(/(\d+)\.xml$/)?.[1] ?? 0);
      const rightNumber = Number(right.match(/(\d+)\.xml$/)?.[1] ?? 0);
      return leftNumber - rightNumber;
    });
  const pages: OfficePage[] = [];
  for (const name of names) {
    const xml = await zip.files[name].async("string");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const lines = [...doc.getElementsByTagNameNS(DRAWING, "p")]
      .map((para) =>
        [...para.getElementsByTagNameNS(DRAWING, "t")]
          .map((node) => node.textContent || "")
          .join("")
          .replace(/\u00a0/g, " ")
          .trim(),
      )
      .filter(Boolean);
    pages.push({
      label: `Slide ${pages.length + 1}`,
      html: lines.length ? lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("") : "<p>This slide has no text.</p>",
    });
  }
  return pages;
}

async function renderOffice(kind: PreviewKind, buffer: ArrayBuffer): Promise<OfficePage[]> {
  if (kind === "docx") return renderDocx(buffer);
  if (kind === "xlsx") return renderXlsx(buffer);
  if (kind === "pptx") return renderPptx(buffer);
  if (kind === "doc") return renderDoc(buffer);
  return [];
}

export default function OfficeSheet({ url, title }: { url: string; title: string }) {
  const [pages, setPages] = useState<OfficePage[]>([]);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [note, setNote] = useState("Opening the file...");
  const kind = previewKind(url);
  useBusy(note === "Opening the file...");

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setPage(1);
    setZoom(1);
    setNote(kind === "other" ? "This file type cannot be shown in Preview." : "Opening the file...");
    if (kind === "other") {
      play("exclamation");
      return;
    }

    (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("file");
      const buffer = await response.arrayBuffer();
      if (cancelled) return;
      const next = await renderOffice(kind, buffer);
      if (cancelled) return;
      if (next.length === 0) {
        setNote("This file could not be opened.");
        play("exclamation");
        return;
      }
      setPages(next);
      setNote("");
      play("default");
    })().catch(() => {
      if (!cancelled) {
        setNote("This file could not be opened.");
        play("exclamation");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [url, kind]);

  const current = pages[page - 1];
  const count = !current ? "Page" : pages.length === 1 ? current.label : `${current.label} (${page} of ${pages.length})`;

  return (
    <div className="sheet-view">
      <div className="sheet-toolbar">
        <button type="button" className="explorer-nav" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}>
          <span className="gel-label">‹</span>
        </button>
        <p className="sheet-count">{count}</p>
        <button type="button" className="explorer-nav" aria-label="Next page" disabled={page >= pages.length} onClick={() => setPage((currentPage) => Math.min(pages.length, currentPage + 1))}>
          <span className="gel-label">›</span>
        </button>
        <button type="button" className="explorer-nav" aria-label="Zoom out" disabled={pages.length === 0} onClick={() => setZoom((currentZoom) => Math.max(0.6, Number((currentZoom - 0.15).toFixed(2))))}>
          <span className="gel-label">−</span>
        </button>
        <button type="button" className="explorer-nav" aria-label="Zoom in" disabled={pages.length === 0} onClick={() => setZoom((currentZoom) => Math.min(1.8, Number((currentZoom + 0.15).toFixed(2))))}>
          <span className="gel-label">+</span>
        </button>
        <p className="sheet-title">{title}</p>
      </div>
      <div className="sheet-stage">
        {note ? <p className="explorer-note">{note}</p> : null}
        {current ? (
          <div className="sheet-stack" style={{ zoom }}>
            <div className="sheet-paper office-paper">
              <div className="office-body" dangerouslySetInnerHTML={{ __html: current.html }} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
