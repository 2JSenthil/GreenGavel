type Source = {
  id?: number;
  n?: number;
  document_name?: string;
  source_name?: string;
  body?: string;
  date?: string;
  pdf_url?: string | null;
  source_url?: string;
  is_draft?: boolean;
  status?: string;
};

export function parseAnswerStream(stream: string): string {
  let answer = "";
  let sources: Source[] = [];
  let completed = false;
  for (const frame of stream.replace(/\r\n/g, "\n").split("\n\n")) {
    const lines = frame.split("\n");
    const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
    const data = lines.filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart()).join("\n");
    if (!data) continue;
    const payload = JSON.parse(data);
    if (event === "error") throw new Error("Backend answer failed");
    if (event === "sources") sources = payload.sources ?? [];
    if (event === "delta") answer += payload.text ?? "";
    if (event === "done") {
      if (!payload.ok) throw new Error("Backend rejected answer");
      completed = true;
    }
  }
  if (!completed || !answer.trim()) throw new Error("Incomplete backend answer");
  if (answer.trim() === "The records I have don't say.") return answer.trim();
  const references = sources.map((source, index) => {
    const draft = source.is_draft || source.status?.toLowerCase() === "draft";
    const title = source.document_name ?? source.source_name ?? source.body ?? "Town record";
    const url = source.pdf_url ?? source.source_url;
    return `[${source.n ?? source.id ?? index + 1}] ${draft ? "Draft: " : ""}${title}`
      + `${source.date ? ` (${source.date})` : ""}${url ? `\n${url}` : ""}`;
  });
  return answer.trim() + (references.length ? `\n\nSources:\n${references.join("\n\n")}` : "");
}

export async function askBackend(question: string): Promise<string> {
  // Bindings exist at function runtime, not during builds.
  const baseUrl = process.env.BACKEND_URL;
  if (!baseUrl) throw new Error("BACKEND_URL binding is missing");
  const response = await fetch(new URL("/api/ask", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    signal: AbortSignal.timeout(240_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Backend request failed");
  return parseAnswerStream(await response.text());
}
