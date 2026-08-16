"use client";

import type { UIMessage } from "ai";

/**
 * Transcript storage, one localStorage key per chat session.
 *
 * Deliberately NOT part of the Zustand session store: a transcript carrying
 * product cards and tool results runs to tens of kilobytes, and the store
 * re-serializes its whole persisted slice on every write. Keeping bodies in
 * their own keys means saving a turn costs one transcript, not all of them —
 * and the session index (titles, timestamps) stays tiny and cheap to write.
 */

const PREFIX = "malee-chat:";

/** The single-transcript key from before sessions existed — migrated once, then removed. */
const LEGACY_KEY = "malee-chat";

function key(id: string): string {
  return `${PREFIX}${id}`;
}

export function loadTranscript(id: string): UIMessage[] {
  try {
    const raw = localStorage.getItem(key(id));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    /* corrupt or unavailable storage — start that chat empty */
    return [];
  }
}

/** Write a transcript. Returns false if storage rejected it (quota), so the caller can prune. */
export function writeTranscript(id: string, messages: UIMessage[]): boolean {
  try {
    localStorage.setItem(key(id), JSON.stringify(messages));
    return true;
  } catch {
    return false;
  }
}

export function dropTranscript(id: string): void {
  try {
    localStorage.removeItem(key(id));
  } catch {
    /* ignore */
  }
}

/**
 * Read and remove the pre-sessions transcript, if any. Called once on first
 * load after the upgrade so a shopper mid-conversation keeps it as their first
 * session rather than silently losing it.
 */
export function takeLegacyTranscript(): UIMessage[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    localStorage.removeItem(LEGACY_KEY);
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}
