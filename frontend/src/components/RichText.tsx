import type { ReactNode } from "react";

function inline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(<strong key={`${key}-b${index}`}>{match[1]}</strong>);
    last = start + match[0].length;
    index += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function RichText({ text }: { text: string }) {
  const chunks = text.split(/\s+\*\s+|\n+\s*\*\s+/);
  if (chunks.length < 2) return <>{inline(text, "line")}</>;
  return (
    <>
      {chunks[0] ? inline(chunks[0], "lead") : null}
      <ul className="answer-list">
        {chunks.slice(1).map((item, index) => (
          <li key={index}>{inline(item, `item-${index}`)}</li>
        ))}
      </ul>
    </>
  );
}
