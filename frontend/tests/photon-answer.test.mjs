import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript/lib/typescript.js";

const source = readFileSync(new URL("../src/lib/photon-answer.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { parseAnswerStream, askBackend } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const event = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const done = event("done", { ok: true });

test("assembles answer deltas with numbered Draft source links", () => {
  const stream = event("sources", { sources: [{ id: 1, document_name: "Minutes", is_draft: true, pdf_url: "https://example.com/minutes.pdf" }] })
    + event("delta", { text: "The council " }) + event("delta", { text: "discussed trees. [1]" }) + done;
  assert.equal(parseAnswerStream(stream.replaceAll("\n", "\r\n")),
    "The council discussed trees. [1]\n\nSources:\n[1] Draft: Minutes\nhttps://example.com/minutes.pdf");
});

test("preserves exact refusal without appending references", () => {
  assert.equal(parseAnswerStream(event("delta", { text: "The records I have don't say." }) + done),
    "The records I have don't say.");
});

test("rejects failed and truncated streams", () => {
  assert.throws(() => parseAnswerStream(event("error", { code: "internal_error" })));
  assert.throws(() => parseAnswerStream(event("delta", { text: "Partial" })));
  assert.throws(() => parseAnswerStream(event("delta", { text: "Partial" }) + event("done", { ok: false })));
});

test("reads the binding at runtime and posts to the backend API", async () => {
  const previous = process.env.BACKEND_URL;
  const previousFetch = globalThis.fetch;
  try {
    delete process.env.BACKEND_URL;
    await assert.rejects(askBackend("trees"), /binding is missing/);
    process.env.BACKEND_URL = "https://backend.internal";
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "https://backend.internal/api/ask");
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), { question: "trees" });
      return new Response(event("delta", { text: "Answer [1]" }) + done);
    };
    assert.equal(await askBackend("trees"), "Answer [1]");
    globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
    await assert.rejects(askBackend("trees"), /request failed/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = previous;
  }
});
