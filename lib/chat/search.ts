"use client";

import { loadTranscript } from "@/lib/chat/storage";
import type { ChatSession } from "@/lib/chat/store";

/**
 * Search across every saved conversation — titles *and* what was actually said,
 * which is how people look for an old chat ("that blender one", "the cake I
 * sent to Kandy") when the title only captures their opening line.
 *
 * Transcripts live one localStorage key per session, so a naive search would
 * parse every chat on every keystroke. The parsed text is cached per session
 * and invalidated by `updatedAt`, so a warm search re-reads nothing: a chat is
 * re-parsed only after it changes.
 */

export interface SearchHit {
  session: ChatSession;
  /** Absent when the title matched — the row already shows it. */
  snippet?: { before: string; match: string; after: string };
}

const cache = new Map<string, { stamp: number; lines: string[] }>();

/** Characters of context shown either side of a match. */
const CONTEXT = 36;

function transcriptLines(session: ChatSession): string[] {
  const cached = cache.get(session.id);
  if (cached && cached.stamp === session.updatedAt) return cached.lines;

  const lines: string[] = [];
  for (const message of loadTranscript(session.id)) {
    const text = (message.parts as { type: string; text?: string }[])
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) lines.push(text);
  }

  cache.set(session.id, { stamp: session.updatedAt, lines });
  // Sessions are capped at 40, but deletions leave entries behind — drop the
  // ones that no longer belong to a live chat rather than growing forever.
  if (cache.size > 60) {
    for (const id of cache.keys()) {
      if (id !== session.id) cache.delete(id);
      if (cache.size <= 40) break;
    }
  }
  return lines;
}

/** Reads localStorage — call it from an event handler, never during render. */
export function searchSessions(sessions: ChatSession[], query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit[] = [];
  for (const session of [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)) {
    if (session.title.toLowerCase().includes(q)) {
      hits.push({ session });
      continue;
    }
    for (const line of transcriptLines(session)) {
      const at = line.toLowerCase().indexOf(q);
      if (at === -1) continue;
      const end = at + q.length;
      hits.push({
        session,
        snippet: {
          before: (at > CONTEXT ? "…" : "") + line.slice(Math.max(0, at - CONTEXT), at),
          match: line.slice(at, end),
          after: line.slice(end, end + CONTEXT) + (line.length > end + CONTEXT ? "…" : ""),
        },
      });
      break;
    }
  }
  return hits;
}
