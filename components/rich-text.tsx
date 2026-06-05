import type { ReactNode } from "react";

/**
 * Tiny, dependency-free inline formatter for Malee's chat messages: turns
 * **bold**, *italic*, [label](url) and bare http(s) URLs into elements, and
 * leaves everything else untouched so the caller's `whitespace-pre-wrap` keeps
 * line breaks and numbered lists exactly as Malee sent them.
 *
 * Deliberately NOT a full Markdown parser — it covers only what the model
 * actually emits, with a small blast radius: no list/heading restyling, no
 * newline collapsing, no raw HTML, and only safe link schemes are linkified.
 */

// Alternation order matters: link → bold → bare-url → italic. No look-behind/
// -ahead (older Safari lacks it); italic instead requires non-space edges so
// stray asterisks ("Rs 5 * 3") aren't mistaken for emphasis.
const INLINE =
  /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^\n]+?)\*\*|(https?:\/\/[^\s<]+)|\*([^*\s](?:[^*\n]*?[^*\s])?)\*/g;

const SAFE_SCHEME = /^(?:https?:\/\/|mailto:)/i;
const TRAILING_PUNCT = /[.,;:!?)\]]+$/;

function anchor(label: ReactNode, href: string, key: number): ReactNode {
  return (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-brand-dark underline underline-offset-2 hover:text-brand"
    >
      {label}
    </a>
  );
}

// Bold/italic content is parsed recursively, so a link wrapped in emphasis
// (`**[label](url)**`) still becomes a real link. Link labels are NOT recursed,
// which also guarantees we never nest an <a> inside an <a>. Each match consumes
// its delimiters, so every recursive call runs on a strictly shorter string.
function parse(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) nodes.push(text.slice(last, at));

    if (m[1] !== undefined) {
      // [label](url) — only linkify safe schemes, else keep the literal text.
      nodes.push(SAFE_SCHEME.test(m[2]) ? anchor(m[1], m[2], key++) : m[0]);
    } else if (m[3] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold">
          {parse(m[3])}
        </strong>,
      );
    } else if (m[4] !== undefined) {
      // Bare URL — keep trailing punctuation ("…kapruka.com.") out of the link.
      const trail = m[4].match(TRAILING_PUNCT)?.[0] ?? "";
      const url = trail ? m[4].slice(0, -trail.length) : m[4];
      nodes.push(anchor(url, url, key++));
      if (trail) nodes.push(trail);
    } else if (m[5] !== undefined) {
      nodes.push(<em key={key++}>{parse(m[5])}</em>);
    }

    last = at + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return nodes;
}

export function RichText({ text }: { text: string }) {
  return <>{parse(text)}</>;
}
