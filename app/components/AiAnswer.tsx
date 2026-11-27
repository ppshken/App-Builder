import type { ReactNode } from "react";

function inline(text: string) {
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

export default function AiAnswer({ answer }: { answer: string }) {
  const lines = answer.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const key = index;
    const line = lines[index++].trim();
    if (!line) continue;
    if (line.startsWith("```")) {
      const code: string[] = [];
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push(<pre key={key}><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      blocks.push(<h4 key={key}>{inline(heading[1])}</h4>);
      continue;
    }
    const ordered = /^(\d+)[.)]\s+/;
    const unordered = /^[-*+•]\s+/;
    const marker = ordered.test(line) ? ordered : unordered.test(line) ? unordered : null;
    if (marker) {
      const items = [line.replace(marker, "")];
      while (index < lines.length && marker.test(lines[index].trim())) items.push(lines[index++].trim().replace(marker, ""));
      const Tag = marker === ordered ? "ol" : "ul";
      blocks.push(<Tag key={key} start={marker === ordered ? Number(line.match(ordered)?.[1]) : undefined}>
        {items.map((item, offset) => <li key={offset}>{inline(item)}</li>)}
      </Tag>);
      continue;
    }
    blocks.push(<p key={key}>{inline(line)}</p>);
  }
  return <div className="ai-answer-copy">{blocks}</div>;
}
