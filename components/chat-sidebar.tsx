"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Flower2, MessageSquare, PanelLeftClose, Pencil, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import { useAccount } from "@/lib/account/store";
import { groupSessions, useChats, type ChatSession } from "@/lib/chat/store";
import { searchSessions, type SearchHit } from "@/lib/chat/search";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LocaleSwitcher } from "@/components/locale-switcher";

/**
 * Today's date, as external state.
 *
 * The "Today / Yesterday / Previous 7 days" buckets need the current time, and
 * a clock can't be read during render — it's impure, and React may reuse the
 * result. Subscribing to it keeps the component pure, and snapshotting the
 * *start of today* rather than the instant means the value only changes when
 * the buckets actually do: once, at midnight.
 */
function subscribeToMidnight(onChange: () => void): () => void {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}
const startOfToday = () => new Date().setHours(0, 0, 0, 0);

/**
 * The conversation sidebar — the shape people now expect from a chat app.
 *
 * One element, two behaviours: below `lg` it's a fixed off-canvas drawer over
 * the chat (mobile-first — the chat keeps the full viewport width), and from
 * `lg` up it's a static column that collapses to zero width. The inner panel
 * keeps a fixed width so the collapse animates as a clean wipe rather than
 * squashing the text.
 *
 * Sessions scope the *conversation* only: the cart, saved details, and order
 * history are global, so switching chats never moves the shopper's basket.
 */
export function ChatSidebar({
  open,
  pinned,
  ready,
  activeId,
  onClose,
  onCollapse,
  onNew,
  onOpen,
  onDelete,
  onOpenAccount,
}: {
  /** Mobile drawer state (ignored from `lg` up). */
  open: boolean;
  /** Desktop expanded state (ignored below `lg`). */
  pinned: boolean;
  /** Stores rehydrated? Until then the width animation is off, so a restored
   *  "collapsed" preference snaps into place instead of wiping shut on load. */
  ready: boolean;
  activeId: string | null;
  onClose: () => void;
  onCollapse: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenAccount: () => void;
}) {
  const t = useT();
  const sessions = useChats((s) => s.sessions);

  // 0 on the server, where the list is empty anyway (the store skips hydration).
  const today = useSyncExternalStore(subscribeToMidnight, startOfToday, () => 0);
  const groups = groupSessions(sessions, today);

  // Search reads transcripts out of localStorage, so it runs in the change
  // handler and parks its results in state — never during render.
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const search = (value: string) => {
    setQuery(value);
    setHits(searchSessions(useChats.getState().sessions, value));
  };
  const searching = query.trim().length > 0;
  // A chat renamed or deleted mid-search shouldn't linger in the results.
  const live = searching
    ? hits.flatMap((hit) => {
        const session = sessions.find((s) => s.id === hit.session.id);
        return session ? [{ ...hit, session }] : [];
      })
    : [];

  return (
    <>
      {/* Mobile scrim. Absent from the layout entirely on desktop. */}
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/45 transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        aria-label={t.sidebar.title}
        className={cn(
          "fixed inset-y-0 left-0 z-50 overflow-hidden bg-cream shadow-2xl transition-transform duration-300 ease-out",
          "w-[86%] max-w-[19rem]",
          open ? "translate-x-0" : "-translate-x-full",
          // From lg it stops floating and becomes a real column that wipes shut.
          "lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:shadow-none lg:duration-200",
          ready && "lg:transition-[width]",
          pinned ? "lg:w-72 lg:border-r lg:border-line" : "lg:w-0",
        )}
      >
        <div className="flex h-full w-full flex-col lg:w-72">
          <div className="flex items-center gap-2 px-3 pb-2 pt-3">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent text-white">
                <Flower2 className="h-4 w-4" />
              </div>
              <span className="font-display text-lg">Malee</span>
            </div>
            <button
              onClick={onClose}
              aria-label={t.controls.close}
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-black/5 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={onCollapse}
              aria-label={t.controls.collapseSidebar}
              title={t.controls.collapseSidebar}
              className="ml-auto hidden h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-black/5 hover:text-ink lg:flex"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          <div className="px-3 pb-2">
            <button
              onClick={onNew}
              className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm font-semibold text-ink shadow-sm transition hover:border-brand hover:text-brand-dark"
            >
              <Plus className="h-4 w-4 text-brand" />
              {t.controls.newChat}
            </button>
          </div>

          {sessions.length > 0 && (
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  aria-label={t.sidebar.search}
                  placeholder={t.sidebar.search}
                  onChange={(e) => search(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") search("");
                  }}
                  // 16px, or iOS Safari zooms the viewport on focus.
                  className="min-h-10 w-full rounded-xl border border-line bg-card pl-9 pr-9 text-base outline-none transition focus:border-brand lg:text-sm"
                />
                {searching && (
                  <button
                    onClick={() => search("")}
                    aria-label={t.sidebar.searchClear}
                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-2 pb-3">
            {sessions.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs leading-relaxed text-muted">
                {t.sidebar.empty}
              </p>
            ) : searching ? (
              live.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs leading-relaxed text-muted">
                  {t.sidebar.noResults(query.trim())}
                </p>
              ) : (
                <div>
                  <h3 className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted/80">
                    {t.sidebar.resultsCount(live.length)}
                  </h3>
                  <ul className="space-y-0.5">
                    {live.map((hit) => (
                      <SessionRow
                        key={hit.session.id}
                        session={hit.session}
                        snippet={hit.snippet}
                        active={hit.session.id === activeId}
                        onOpen={() => {
                          search("");
                          onOpen(hit.session.id);
                        }}
                        onDelete={() => onDelete(hit.session.id)}
                      />
                    ))}
                  </ul>
                </div>
              )
            ) : (
              groups.map((group) => (
                <div key={group.key}>
                  <h3 className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted/80">
                    {t.sidebar.groups[group.key]}
                  </h3>
                  <ul className="space-y-0.5">
                    {group.sessions.map((session) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        active={session.id === activeId}
                        onOpen={() => onOpen(session.id)}
                        onDelete={() => onDelete(session.id)}
                      />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </nav>

          <SidebarFooter onOpenAccount={onOpenAccount} />
        </div>
      </aside>
    </>
  );
}

function SessionRow({
  session,
  active,
  snippet,
  onOpen,
  onDelete,
}: {
  session: ChatSession;
  active: boolean;
  /** Set when the search matched inside the conversation rather than the title. */
  snippet?: SearchHit["snippet"];
  onOpen: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const rename = useChats((s) => s.rename);
  const [mode, setMode] = useState<"idle" | "rename" | "confirm">("idle");
  const [draft, setDraft] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "rename") inputRef.current?.select();
  }, [mode]);

  function beginRename() {
    setDraft(session.title);
    setMode("rename");
  }

  function commitRename() {
    const clean = draft.trim();
    if (clean) rename(session.id, clean);
    setMode("idle");
  }

  if (mode === "rename") {
    return (
      <li className="flex items-center gap-1 rounded-lg bg-brand/10 px-1.5 py-1">
        <input
          ref={inputRef}
          value={draft}
          aria-label={t.sidebar.rename}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitRename();
            }
            if (e.key === "Escape") setMode("idle");
          }}
          onBlur={commitRename}
          // 16px keeps iOS Safari from zooming the viewport on focus.
          className="min-h-9 min-w-0 flex-1 rounded-md border border-brand/40 bg-card px-2 text-base outline-none lg:text-sm"
        />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={commitRename}
          aria-label={t.sidebar.renameSave}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand transition hover:bg-black/5"
        >
          <Check className="h-4 w-4" />
        </button>
      </li>
    );
  }

  if (mode === "confirm") {
    return (
      <li className="rounded-lg bg-blush px-3 py-2">
        <p className="text-xs text-ink">{t.sidebar.deleteConfirm}</p>
        <div className="mt-1.5 flex gap-2">
          <button
            onClick={onDelete}
            className="rounded-full bg-[#b4503f] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            {t.sidebar.delete}
          </button>
          <button
            onClick={() => setMode("idle")}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-black/5"
          >
            {t.sidebar.keep}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "group flex items-center rounded-lg transition",
        active ? "bg-brand/12 text-brand-dark" : "text-ink hover:bg-black/5",
      )}
    >
      <button
        onClick={onOpen}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left"
      >
        <MessageSquare
          className={cn("h-3.5 w-3.5 shrink-0", active ? "text-brand" : "text-muted")}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{session.title || t.sidebar.untitled}</span>
          {snippet && (
            <span className="block truncate text-[11px] text-muted">
              {snippet.before}
              <mark className="bg-accent/30 text-ink">{snippet.match}</mark>
              {snippet.after}
            </span>
          )}
        </span>
      </button>
      {/* Always visible on touch (there is no hover); revealed on hover/focus from lg up. */}
      <span className="flex shrink-0 items-center pr-1 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
        <button
          onClick={beginRename}
          aria-label={t.sidebar.rename}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:text-ink lg:h-8 lg:w-8"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setMode("confirm")}
          aria-label={t.sidebar.delete}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:text-[#b4503f] lg:h-8 lg:w-8"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </span>
    </li>
  );
}

/**
 * Account + preferences live at the foot of the sidebar rather than in the
 * header — on a 375px screen the header can't hold six controls, and this is
 * where people look for them anyway.
 */
function SidebarFooter({ onOpenAccount }: { onOpenAccount: () => void }) {
  const t = useT();
  const email = useAccount((s) => s.email);
  const name = useAccount((s) => s.name);

  return (
    <div className="border-t border-line p-2">
      <button
        onClick={onOpenAccount}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left transition hover:bg-black/5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
          <UserRound className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">
            {name || email || t.sidebar.signedOut}
          </span>
          <span className="block truncate text-[11px] text-muted">
            {email ? (name ? email : t.sidebar.accountHint) : t.sidebar.signedOutHint}
          </span>
        </span>
      </button>
      <div className="mt-1 flex items-center gap-1 px-1.5">
        <LocaleSwitcher align="up" />
        <ThemeSwitcher align="up" />
      </div>
    </div>
  );
}
