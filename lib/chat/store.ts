import type { UIMessage } from "ai";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { dropTranscript, writeTranscript } from "@/lib/chat/storage";

/**
 * The chat session index — the sidebar's model.
 *
 * Only metadata lives here (title, timestamps); the messages sit in their own
 * localStorage keys (lib/chat/storage.ts). Sessions are the *conversation*
 * only: the cart, saved details, and order history stay global across chats,
 * because a shopper has one basket and one account no matter how many threads
 * they keep open.
 *
 * A chat is registered on its FIRST message, not when "New chat" is tapped —
 * so an abandoned empty chat never clutters the list.
 */

export interface ChatSession {
  id: string;
  /** Derived from the first message, or renamed by the shopper. Empty = show the localized default. */
  title: string;
  createdAt: number;
  updatedAt: number;
}

/** Plenty for a browser-local history; the oldest transcripts are pruned first under quota pressure. */
const MAX_SESSIONS = 40;

/** A title long enough to tell two grocery runs apart, short enough for a 280px sidebar. */
const TITLE_MAX = 48;

interface ChatsState {
  sessions: ChatSession[];
  /** The chat being viewed. Null only before hydration or on a brand-new unsent chat. */
  activeId: string | null;
  /**
   * Is the desktop sidebar expanded? Persisted because collapsing it is a
   * lasting preference — someone who wants the chat full-width wants that on
   * every visit, not just until the next reload. (Below `lg` it's ignored: the
   * sidebar is a drawer there.)
   */
  sidebarPinned: boolean;
  setSidebarPinned: (pinned: boolean) => void;
  /** Register a draft id as a real session (first message sent) and make it active. */
  start: (id: string, title: string) => void;
  select: (id: string | null) => void;
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
  /** Persist a transcript and bump the session's updatedAt. */
  save: (id: string, messages: UIMessage[]) => void;
}

export const useChats = create<ChatsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeId: null,
      sidebarPinned: true,

      setSidebarPinned: (sidebarPinned) => set({ sidebarPinned }),

      start: (id, title) =>
        set((s) => {
          if (s.sessions.some((c) => c.id === id)) return { activeId: id };
          const now = Date.now();
          const kept = s.sessions.slice(0, MAX_SESSIONS - 1);
          // Anything past the cap loses its transcript too — no orphan keys.
          for (const dropped of s.sessions.slice(MAX_SESSIONS - 1)) dropTranscript(dropped.id);
          return {
            sessions: [{ id, title, createdAt: now, updatedAt: now }, ...kept],
            activeId: id,
          };
        }),

      select: (id) => set({ activeId: id }),

      rename: (id, title) =>
        set((s) => ({
          sessions: s.sessions.map((c) =>
            c.id === id ? { ...c, title: title.slice(0, TITLE_MAX * 2) } : c,
          ),
        })),

      remove: (id) => {
        dropTranscript(id);
        set((s) => ({
          sessions: s.sessions.filter((c) => c.id !== id),
          // Deleting the open chat drops you onto a fresh one (the shell reacts to null).
          activeId: s.activeId === id ? null : s.activeId,
        }));
      },

      save: (id, messages) => {
        if (!writeTranscript(id, messages)) {
          // Out of quota: shed the oldest OTHER transcripts (their sessions stay
          // listed but open empty — better than losing the chat in front of you)
          // and retry until it fits.
          const stale = [...get().sessions]
            .filter((c) => c.id !== id)
            .sort((a, b) => a.updatedAt - b.updatedAt);
          for (const old of stale) {
            dropTranscript(old.id);
            if (writeTranscript(id, messages)) break;
          }
        }
        set((s) => ({
          sessions: s.sessions.map((c) => (c.id === id ? { ...c, updatedAt: Date.now() } : c)),
        }));
      },
    }),
    {
      name: "malee-chats",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        sessions: s.sessions,
        activeId: s.activeId,
        sidebarPinned: s.sidebarPinned,
      }),
    },
  ),
);

/**
 * A session title from the shopper's opening line — free, instant, and offline,
 * where an LLM-generated title would cost a request against the free-tier quota
 * on every new chat. Renameable in the sidebar.
 */
export function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > TITLE_MAX ? `${clean.slice(0, TITLE_MAX - 1).trimEnd()}…` : clean;
}

/** The first user message of a restored transcript, for titling a migrated chat. */
export function firstUserText(messages: UIMessage[]): string {
  for (const m of messages) {
    if (m.role !== "user") continue;
    const text = (m.parts as { type: string; text?: string }[])
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
    if (text.trim()) return text;
  }
  return "";
}

export type SessionGroupKey = "today" | "yesterday" | "week" | "older";

/** ChatGPT-style date buckets. Pure, so the sidebar stays a dumb renderer. */
export function groupSessions(
  sessions: ChatSession[],
  now: number,
): { key: SessionGroupKey; sessions: ChatSession[] }[] {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const day = 86_400_000;
  const buckets: Record<SessionGroupKey, ChatSession[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };

  for (const s of [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)) {
    if (s.updatedAt >= startOfToday) buckets.today.push(s);
    else if (s.updatedAt >= startOfToday - day) buckets.yesterday.push(s);
    else if (s.updatedAt >= startOfToday - 7 * day) buckets.week.push(s);
    else buckets.older.push(s);
  }

  return (["today", "yesterday", "week", "older"] as const)
    .map((key) => ({ key, sessions: buckets[key] }))
    .filter((g) => g.sessions.length > 0);
}
