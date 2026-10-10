"use client";

import PdfSheet from "./PdfSheet";
import type { PreviewDoc } from "./preview";

export default function PreviewApp({ doc }: { doc: PreviewDoc | null }) {
  if (!doc) {
    return (
      <div className="preview-empty">
        <img src="/aero/icons/file.png" alt="" width={64} height={64} />
        <p>No file is open. Open a PDF from Chat, Talk, or Records.</p>
      </div>
    );
  }
  return <PdfSheet key={doc.url} url={doc.url} title={doc.title} />;
}
