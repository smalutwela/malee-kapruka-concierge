"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { ArrowUp, Flower2, Loader2, Menu, Minus, PanelLeftOpen, Plus, RotateCcw, ShoppingBag, Sparkles, SquarePen, Trash2, UserRound, X } from "lucide-react";
import {
  AccountProfileCard,
  AddressBookCard,
  CartAddCard,
  CategoryChips,
  DeliveryQuoteCard,
  OrderHistoryCard,
  OrderSummaryCard,
  ProductDetailCard,
  ProductGrid,
  ReorderCard,
  TrackingTimeline,
  type AskFn,
} from "@/components/cards";
import { AccountDrawer } from "@/components/account-drawer";
import { ChatSidebar } from "@/components/chat-sidebar";
import { Sheet } from "@/components/sheet";
import type {
  AccountOrderHistory,
  AddressBook,
  AddToCartToolOutput,
  CategoryList,
  CreateOrderToolInput,
  CustomerProfile,
  DeliveryQuote,
  OrderConfirmation,
  OrderTracking,
  ProductDetail,
  ReorderPlan,
  SearchResults,
} from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";
import { cartCount, cartSubtotal, useCart } from "@/lib/cart/store";
import { useCaptureCartAdds } from "@/lib/cart/capture";
import { useAccount } from "@/lib/account/store";
import { useCaptureAccount } from "@/lib/account/capture";
import { useProfile } from "@/lib/profile/store";
import { useOrders, type OrderLine } from "@/lib/orders/store";
import { useCaptureOrders } from "@/lib/orders/capture";
import { deriveTitle, firstUserText, useChats } from "@/lib/chat/store";
import { loadTranscript, takeLegacyTranscript, writeTranscript } from "@/lib/chat/storage";
import { RichText } from "@/components/rich-text";
import { useLocale, useT } from "@/lib/i18n/context";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/* part shapes we read off UIMessage.parts */
type AnyPart = {
  type: string;
  text?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
};

/* Shopping-mode chips, in display order — labels come from the active locale.
   Everyday self-shopping leads; gifting is one mode among many. */
const MODE_KEYS = [
  "groceries",
  "electronics",
  "home",
  "beauty",
  "fashion",
  "baby",
  "gift",
] as const;

/* The tool loop is presented as a small team of specialists at work, so the
   experience feels like more than one search box. Each tool maps to the
   specialist that "runs" it; Malee herself is the concierge who talks. */
const SPECIALIST: Record<string, "shopper" | "logistics" | "account"> = {
  searchProducts: "shopper",
  presentProducts: "shopper",
  getProduct: "shopper",
  addToCart: "shopper",
  listCategories: "shopper",
  listDeliveryCities: "logistics",
  checkDelivery: "logistics",
  createOrder: "logistics",
  trackOrder: "logistics",
  getAccountProfile: "account",
  getOrderHistory: "account",
  getSavedAddresses: "account",
  reorderPastOrder: "account",
};
const SPECIALIST_EMOJI = { shopper: "🛍️", logistics: "🚚", account: "👤" } as const;

/* Conversations are persisted per session (lib/chat/storage.ts) so a refresh
   resumes where the shopper left off and the sidebar can offer every earlier
   chat — alongside the persisted cart, profile, and order history, which stay
   global across sessions (one shopper, one basket, many conversations).

   The chat id can't be generated during the first render: it must match on the
   server and the client, and only after hydration do we know whether to restore
   a saved session or mint a fresh one. This placeholder covers that first paint,
   when the transcript is empty anyway. */
const DRAFT_CHAT_ID = "draft";

/* The transport builds the request body at SEND time, so every request —
   including a "Try again" regenerate — carries the live cart, saved details,
   and chosen language. (A per-sendMessage body would silently drop them on
   regenerate.) The stores are read via getState(); the locale lives in this
   module-scope holder, synced from context by ChatShell. */
let currentLocale: Locale = DEFAULT_LOCALE;
const chatTransport = new DefaultChatTransport<UIMessage>({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ messages, body }) => ({
    body: {
      messages,
      cart: useCart.getState().items,
      locale: currentLocale,
      profile: useProfile.getState().details,
      // Who the shopper signed in as. The server only honours this for lookups
      // if it matches an email the shopper actually typed (see the route).
      account: { email: useAccount.getState().email, name: useAccount.getState().name },
      ...body,
    },
  }),
});

function Avatar({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent text-white shadow-sm",
        size === "lg" ? "h-14 w-14" : "h-8 w-8",
      )}
    >
      <Flower2 className={size === "lg" ? "h-7 w-7" : "h-4 w-4"} />
    </div>
  );
}

function noteOf(output: unknown): { error?: string; note?: string } | null {
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (typeof o.error === "string") return { error: o.error };
    if (typeof o.note === "string") return { note: o.note };
  }
  return null;
}

function ToolView({
  name,
  input,
  output,
  onAsk,
}: {
  name: string;
  input: unknown;
  output: unknown;
  onAsk: AskFn;
}) {
  const t = useT();
  const n = noteOf(output);
  if (n?.error) {
    return (
      <p className="my-1 text-xs text-[#b4503f]">
        {t.errors.toolPrefix}
        {n.error}
      </p>
    );
  }

  switch (name) {
    case "searchProducts":
      // Private research for the model — cards render via presentProducts only.
      return null;
    case "presentProducts":
      return (output as SearchResults).results?.length ? (
        <ProductGrid data={output as SearchResults} onAsk={onAsk} />
      ) : null;
    case "getProduct":
      return (output as ProductDetail).id ? (
        <ProductDetailCard product={output as ProductDetail} />
      ) : null;
    case "addToCart":
      return (output as AddToCartToolOutput).item ? (
        <CartAddCard data={output as AddToCartToolOutput} />
      ) : null;
    case "listCategories":
      return <CategoryChips data={output as CategoryList} onAsk={onAsk} />;
    case "checkDelivery":
      return typeof (output as DeliveryQuote).available === "boolean" ? (
        <DeliveryQuoteCard quote={output as DeliveryQuote} />
      ) : null;
    case "createOrder":
      return (output as OrderConfirmation).checkout_url ? (
        <OrderSummaryCard
          order={output as OrderConfirmation}
          input={input as CreateOrderToolInput | undefined}
        />
      ) : null;
    case "trackOrder":
      return (output as OrderTracking).order_number ? (
        <TrackingTimeline order={output as OrderTracking} />
      ) : null;
    case "getAccountProfile": {
      const customer = (output as { customer?: CustomerProfile }).customer;
      return customer ? <AccountProfileCard customer={customer} /> : null;
    }
    case "getOrderHistory":
      return (output as AccountOrderHistory).orders?.length ? (
        <OrderHistoryCard history={output as AccountOrderHistory} onAsk={onAsk} />
      ) : null;
    case "getSavedAddresses":
      return (output as AddressBook).addresses?.length ? (
        <AddressBookCard book={output as AddressBook} onAsk={onAsk} />
      ) : null;
    case "reorderPastOrder":
      return (output as ReorderPlan).reference ? (
        <ReorderCard plan={output as ReorderPlan} />
      ) : null;
    case "listDeliveryCities": {
      const cities = (output as { cities?: { name: string }[] }).cities ?? [];
      if (!cities.length) return null;
      return (
        <div className="my-1 flex flex-wrap gap-1.5">
          {cities.slice(0, 12).map((c) => (
            <button
              key={c.name}
              onClick={() => onAsk(t.prompts.deliverTo(c.name))}
              className="rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink transition hover:border-brand"
            >
              {c.name}
            </button>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

function MessageView({ message, onAsk }: { message: UIMessage; onAsk: AskFn }) {
  const t = useT();
  const parts = message.parts as AnyPart[];

  if (message.role === "user") {
    const text = parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-dark px-4 py-2.5 text-sm text-white shadow-sm">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        {parts.map((part, i) => {
          if (part.type === "text" && part.text?.trim()) {
            return (
              <p key={i} className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                {/* trim: stray blank lines around a part otherwise render as a gap
                    between the text and the cards that follow it */}
                <RichText text={part.text.trim()} />
              </p>
            );
          }
          if (part.type.startsWith("tool-")) {
            const name = part.type.slice(5);
            if (part.state === "output-available") {
              return (
                <ToolView key={i} name={name} input={part.input} output={part.output} onAsk={onAsk} />
              );
            }
            if (part.state === "output-error") {
              return (
                <p key={i} className="text-xs text-[#b4503f]">
                  {t.errors.toolStep}
                </p>
              );
            }
            const spec = SPECIALIST[name];
            return (
              <div
                key={i}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-xs text-muted"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                {spec && (
                  <span className="font-semibold text-ink">
                    {SPECIALIST_EMOJI[spec]} {t.specialists[spec]}
                  </span>
                )}
                <span>{t.tools[name as keyof typeof t.tools] ?? t.tools.working}</span>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function Welcome({
  onPick,
  onReorder,
  onSignIn,
}: {
  onPick: AskFn;
  onReorder: (items: OrderLine[]) => void;
  onSignIn: () => void;
}) {
  const t = useT();
  // Reordering is the single most under-rated repeat-commerce lever — when this
  // shopper has history, the fastest path to "my usual" sits right up front.
  const lastOrder = useOrders((s) => s.orders[0]);
  // Signed in? Jump straight to the real Kapruka history. Otherwise the chip
  // opens the drawer so they can type their email — we never assume one.
  const accountEmail = useAccount((s) => s.email);
  return (
    <div className="animate-rise flex flex-col items-center px-2 pt-10 text-center sm:pt-16">
      <Avatar size="lg" />
      <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
        {t.welcome.greetingPre}
        <span className="italic text-brand-dark">Malee</span>
        {t.welcome.greetingPost}
      </h2>
      <p className="mt-2 max-w-md text-[15px] text-muted">{t.welcome.subtitle}</p>

      {/* w-full matters: without a definite width here, the column sizes to the
          reorder chip's max-content (a long item list), the chip's max-w-full
          resolves against that, truncate never kicks in — and the page picks up
          a horizontal scrollbar on a phone. */}
      <div className="mt-6 flex w-full max-w-md flex-col items-center gap-2">
        {lastOrder && lastOrder.items.length > 0 && (
          <button
            onClick={() => onReorder(lastOrder.items)}
            className="flex max-w-full items-center gap-2.5 overflow-hidden rounded-full border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-medium text-brand-dark shadow-sm transition hover:border-brand hover:bg-brand/15"
          >
            <RotateCcw className="h-4 w-4 shrink-0" />
            <span className="shrink-0">{t.welcome.reorderLast}</span>
            <span className="min-w-0 truncate text-xs text-muted">
              {lastOrder.items.map((i) => i.name).join(", ")}
            </span>
          </button>
        )}
        {accountEmail ? (
          <button
            onClick={() => onPick(t.prompts.myOrders)}
            className="flex max-w-full items-center gap-2.5 rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-brand hover:text-brand-dark"
          >
            <UserRound className="h-4 w-4 shrink-0 text-brand" />
            <span className="truncate">{t.welcome.signIn}</span>
          </button>
        ) : (
          // Signed out this is not a shortcut, it's a pitch — so it leaves the
          // pill shape behind entirely. As a rounded chip it read as a seventh
          // category next to Groceries/Electronics/…, which is the one thing
          // it must not look like.
          <button
            onClick={onSignIn}
            className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-brand/40 bg-brand/5 px-4 py-3 text-left shadow-sm transition hover:border-brand hover:bg-brand/10"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{t.welcome.signInTitle}</span>
              <span className="block text-xs text-muted">{t.welcome.signInSub}</span>
            </span>
            <ArrowUp className="h-4 w-4 shrink-0 rotate-45 text-brand" />
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {MODE_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => onPick(t.prompts.mode[key])}
            className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium text-ink shadow-sm transition hover:border-brand hover:text-brand-dark"
          >
            {t.welcome.modes[key]}
          </button>
        ))}
      </div>

      <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-1">
        {t.welcome.examples.map((ex) => (
          <button
            key={ex}
            onClick={() => onPick(ex)}
            className="group flex items-center gap-3 rounded-xl border border-line bg-card/70 px-4 py-3 text-left text-sm text-ink transition hover:border-brand hover:bg-card"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-accent" />
            <span className="flex-1">&ldquo;{ex}&rdquo;</span>
            <ArrowUp className="h-4 w-4 rotate-45 text-muted transition group-hover:text-brand" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Composer({ onSend, disabled }: { onSend: AskFn; disabled: boolean }) {
  const t = useT();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    if (ref.current) ref.current.style.height = "auto";
  }

  return (
    <div className="safe-bottom border-t border-line bg-cream/80 backdrop-blur">
      <div className="mx-auto max-w-3xl px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-card p-2 shadow-sm focus-within:border-brand">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            placeholder={t.composer.placeholder}
            onChange={(e) => {
              setValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            // 16px on mobile is not a style choice: iOS Safari zooms the whole
            // viewport when you focus an input smaller than that, and never
            // zooms back out.
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-muted/70 sm:text-[15px]"
          />
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            aria-label={t.controls.send}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-dark disabled:opacity-40 sm:h-9 sm:w-9"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1.5 line-clamp-2 text-center text-[11px] text-muted/80">
          {t.composer.footer}
        </p>
      </div>
    </div>
  );
}

export function ChatShell() {
  const t = useT();
  const { locale } = useLocale();

  // Keep the module-scope transport's locale in sync with the UI language.
  useEffect(() => {
    currentLocale = locale;
  }, [locale]);
  // The open conversation. `id` and `initial` move together in one state update
  // so useChat always rebuilds its Chat with the matching transcript: the SDK
  // recreates its internal Chat whenever this `id` changes, which is exactly the
  // isolation we want — a late chunk from a stream we abandoned lands in the old
  // instance, which nothing renders and nothing saves.
  const [chat, setChat] = useState<{ id: string; initial: UIMessage[] }>({
    id: DRAFT_CHAT_ID,
    initial: [],
  });
  const { messages, sendMessage, status, error, regenerate, stop } = useChat({
    id: chat.id,
    messages: chat.initial,
    transport: chatTransport,
  });
  const busy = status === "submitted" || status === "streaming";
  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Rehydration can flip the desktop sidebar shut a frame after first paint. If
  // the width transition were live at that moment, a restored "collapsed"
  // preference would animate closed on every load; it should just *be* closed.
  // Enabled a painted frame later, so only real toggles animate.
  const [animateSidebar, setAnimateSidebar] = useState(false);
  const activeId = useChats((s) => s.activeId);
  // Collapsing the desktop sidebar is a preference, so it lives in the persisted
  // store rather than component state.
  const sidebarPinned = useChats((s) => s.sidebarPinned);
  const setSidebarPinned = useChats((s) => s.setSidebarPinned);

  // Only a turn the shopper actually started is worth writing back. Merely
  // *opening* an old chat must not re-save it — that would bump its updatedAt
  // and shuffle it to the top of the sidebar just for being read.
  const dirty = useRef(false);

  // The persisted stores skip auto-hydration (so the first client render matches
  // the SSR HTML); rehydrate them once on mount, THEN restore the transcript.
  // The order matters: order capture below dedupes against the orders store, so
  // the store must be hydrated before a restored transcript is scanned —
  // otherwise every past order would be re-captured (and re-clear the cart).
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      useCart.persist.rehydrate(),
      useProfile.persist.rehydrate(),
      useOrders.persist.rehydrate(),
      useAccount.persist.rehydrate(),
      useChats.persist.rehydrate(),
    ]).then(() => {
      if (cancelled) return;
      const chats = useChats.getState();

      // One-time upgrade: the single pre-sessions transcript becomes chat #1,
      // titled from its opening line, rather than quietly disappearing.
      // Two frames: one for React to paint the restored layout, one to be sure
      // it landed before transitions are allowed to run.
      const settle = () =>
        requestAnimationFrame(() => requestAnimationFrame(() => setAnimateSidebar(true)));

      const legacy = takeLegacyTranscript();
      if (legacy.length) {
        const id = crypto.randomUUID();
        writeTranscript(id, legacy);
        chats.start(id, deriveTitle(firstUserText(legacy)));
        setChat({ id, initial: legacy });
        setHydrated(true);
        settle();
        return;
      }

      const saved = chats.activeId;
      setChat(
        saved && chats.sessions.some((s) => s.id === saved)
          ? { id: saved, initial: loadTranscript(saved) }
          : { id: crypto.randomUUID(), initial: [] },
      );
      setHydrated(true);
      settle();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the transcript after each settled turn (skip per-token mid-stream writes).
  useEffect(() => {
    if (!hydrated || busy || !dirty.current || !messages.length) return;
    dirty.current = false;
    useChats.getState().save(chat.id, messages);
  }, [messages, busy, hydrated, chat.id]);

  // Record every placed order to local history + seed saved details, and apply
  // every agent cart-add to the cart store. Both gated on hydration so a
  // restored transcript is only scanned once the stores can dedupe it.
  useCaptureOrders(messages, hydrated);
  useCaptureCartAdds(messages, hydrated);
  // Cache the Kapruka display name and seed checkout details from the account.
  useCaptureAccount(messages, hydrated);

  // The transport injects cart/locale/profile at request time (see above).
  // A chat earns its place in the sidebar on its first message — never on "New
  // chat" — so an opened-and-abandoned conversation leaves nothing behind.
  const ask: AskFn = (text) => {
    const chats = useChats.getState();
    if (chats.sessions.some((s) => s.id === chat.id)) {
      if (chats.activeId !== chat.id) chats.select(chat.id);
    } else {
      chats.start(chat.id, deriveTitle(text));
    }
    dirty.current = true;
    void sendMessage({ text });
  };

  /** Flush the open chat before leaving it (a turn interrupted mid-stream still counts). */
  const flush = () => {
    if (busy) stop();
    if (dirty.current && messages.length) useChats.getState().save(chat.id, messages);
    dirty.current = false;
  };

  const openSession = (id: string) => {
    setSidebarOpen(false);
    if (id === chat.id) return;
    flush();
    useChats.getState().select(id);
    setChat({ id, initial: loadTranscript(id) });
  };

  const deleteSession = (id: string) => {
    useChats.getState().remove(id);
    // Deleting the chat you're reading drops you onto a fresh one. Don't flush()
    // here — the transcript is gone, and re-saving it would recreate the key.
    if (id === chat.id) {
      if (busy) stop();
      dirty.current = false;
      setChat({ id: crypto.randomUUID(), initial: [] });
    }
  };

  // Reorder: refill the cart from a past order, then open the cart to review.
  const reorder = (items: OrderLine[]) => {
    const add = useCart.getState().add;
    for (const i of items) {
      add({ id: i.id, name: i.name, price: i.price, image: i.image, icingText: i.icingText }, i.quantity);
    }
    setAccountOpen(false);
    setCartOpen(true);
  };

  // Start a fresh conversation — the earlier one stays in the sidebar, and the
  // cart, profile, and orders carry over untouched.
  const newChat = () => {
    setSidebarOpen(false);
    flush();
    useChats.getState().select(null);
    setChat({ id: crypto.randomUUID(), initial: [] });
  };

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const lastIsAssistant = messages[messages.length - 1]?.role === "assistant";

  return (
    <div className="flex h-dvh overflow-hidden">
      <ChatSidebar
        open={sidebarOpen}
        pinned={sidebarPinned}
        ready={animateSidebar}
        activeId={activeId}
        onClose={() => setSidebarOpen(false)}
        onCollapse={() => setSidebarPinned(false)}
        onNew={newChat}
        onOpen={openSession}
        onDelete={deleteSession}
        onOpenAccount={() => {
          setSidebarOpen(false);
          setAccountOpen(true);
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-cream/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label={t.controls.openSidebar}
              className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-black/5 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            {!sidebarPinned && (
              <button
                onClick={() => setSidebarPinned(true)}
                aria-label={t.controls.expandSidebar}
                title={t.controls.expandSidebar}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-black/5 hover:text-ink lg:flex"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <div className="hidden sm:block">
              <Avatar />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="font-display text-lg">Malee</div>
              <div className="hidden truncate text-[11px] text-muted sm:block">
                {t.header.tagline}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <span className="hidden items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand-dark xl:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {t.header.liveCatalogue}
              </span>
              {messages.length > 0 && <NewChatButton onClick={newChat} />}
              {/* One account control, two faces: an explicit "Sign in" while
                  signed out, the shopper's own initial once they are. Both open
                  the same sheet, so the header count never changes. */}
              <AccountButton onClick={() => setAccountOpen(true)} />
              <CartButton onClick={() => setCartOpen(true)} />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-3xl space-y-5 px-3 py-5 sm:px-4 sm:py-6">
            {messages.length === 0 ? (
              <Welcome onPick={ask} onReorder={reorder} onSignIn={() => setAccountOpen(true)} />
            ) : (
              messages.map((m) => <MessageView key={m.id} message={m} onAsk={ask} />)
            )}
            {busy && !lastIsAssistant && (
              <div className="flex gap-3">
                <Avatar />
                <div className="flex items-center gap-1 pt-3">
                  <Dot /> <Dot delay={150} /> <Dot delay={300} />
                </div>
              </div>
            )}
            {status === "error" && (
              <div className="flex gap-3">
                <Avatar />
                <div className="rounded-2xl rounded-tl-md border border-[#e7c3bb] bg-blush/60 px-4 py-2.5 text-sm text-[#8a3d30]">
                  {error?.message || t.errors.generic}{" "}
                  <button
                    onClick={() => {
                      dirty.current = true;
                      void regenerate();
                    }}
                    className="font-semibold underline underline-offset-2 hover:opacity-80"
                  >
                    {t.errors.tryAgain}
                  </button>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </main>

        <Composer onSend={ask} disabled={busy} />
      </div>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false);
          ask(t.prompts.checkout);
        }}
        onSuggest={() => {
          setCartOpen(false);
          ask(t.prompts.pairWithCart);
        }}
      />
      <AccountDrawer
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onReorder={reorder}
        onTrackNumber={(orderNumber) => {
          setAccountOpen(false);
          ask(t.prompts.trackNumber(orderNumber));
        }}
        onAsk={(text) => {
          setAccountOpen(false);
          ask(text);
        }}
      />
    </div>
  );
}

function NewChatButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      aria-label={t.controls.newChat}
      title={t.controls.newChat}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:border-brand sm:h-9 sm:w-9"
    >
      <SquarePen className="h-4 w-4" />
    </button>
  );
}

/**
 * The header account control — the top-right corner people scan for auth.
 *
 * Signed out it says **Sign in**, in words, at every breakpoint: the label is
 * the whole point, so it never collapses to an icon the way Orders/Cart do.
 * Signed in it becomes the shopper's initial, and the receipt label returns.
 * Either way it opens the one account sheet, so the header keeps three buttons.
 */
function AccountButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  const count = useOrders((s) => s.orders.length);
  const email = useAccount((s) => s.email);
  const name = useAccount((s) => s.name);

  if (!email) {
    return (
      <button
        onClick={onClick}
        aria-label={t.header.signInLabel}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark sm:h-9"
      >
        <UserRound className="h-4 w-4" />
        {t.header.signIn}
      </button>
    );
  }

  // The initial: first letter of the cached display name, else of the email.
  const initial = (name || email).trim().charAt(0).toUpperCase();

  return (
    <button
      onClick={onClick}
      aria-label={t.account.title}
      title={name || email}
      className="relative flex h-10 items-center gap-1.5 rounded-full border border-line bg-card py-0 pl-1 pr-1 text-sm font-medium text-ink transition hover:border-brand sm:h-9 sm:pr-3"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 font-display text-sm text-brand-dark sm:h-7 sm:w-7">
        {initial}
      </span>
      <span className="hidden sm:inline">{t.account.open}</span>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

function CartButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  const count = useCart((s) => cartCount(s.items));
  return (
    <button
      onClick={onClick}
      aria-label={t.controls.openCart}
      className="relative flex h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm font-medium text-ink transition hover:border-brand sm:h-9"
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="hidden sm:inline">{t.cart.label}</span>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

function CartDrawer({
  open,
  onClose,
  onCheckout,
  onSuggest,
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  onSuggest: () => void;
}) {
  const t = useT();
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const subtotal = cartSubtotal(items);
  const currency = items[0]?.price?.currency ?? "LKR";

  return (
    <Sheet open={open} onClose={onClose} label={t.cart.title}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <ShoppingBag className="h-4 w-4 text-brand" />
        <span className="font-display text-lg">{t.cart.title}</span>
        <button
          onClick={onClose}
          aria-label={t.controls.close}
          className="-mr-1 ml-auto flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-black/5 sm:h-8 sm:w-8"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-10 text-center text-muted">
          <ShoppingBag className="h-8 w-8 opacity-40" />
          <p className="text-sm">
            {t.cart.emptyPre}
            <span className="font-medium text-ink">{t.cards.addToCart}</span>
            {t.cart.emptyPost}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          {items.map((i) => (
            <div key={i.id} className="flex gap-3 rounded-xl border border-line bg-card p-2">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-blush">
                {i.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-sm font-medium">{i.name}</div>
                <div className="text-xs text-brand-dark">
                  {formatPrice(i.price?.amount, i.price?.currency)}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    onClick={() => setQty(i.id, i.quantity - 1)}
                    aria-label={t.controls.decreaseQty}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-line hover:bg-black/5 sm:h-6 sm:w-6"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm">{i.quantity}</span>
                  <button
                    onClick={() => setQty(i.id, i.quantity + 1)}
                    aria-label={t.controls.increaseQty}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-line hover:bg-black/5 sm:h-6 sm:w-6"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => remove(i.id)}
                    aria-label={t.controls.remove}
                    className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-[#b4503f]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={clear} className="text-xs text-muted underline-offset-2 hover:underline">
            {t.cart.clear}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="safe-bottom shrink-0 border-t border-line p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-muted">{t.cart.subtotal}</span>
            <span className="font-display text-lg text-brand-dark">
              {formatPrice(subtotal, currency)}
            </span>
          </div>
          <button
            onClick={onSuggest}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-full border border-line py-2.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand-dark"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" /> {t.cart.suggestAddons}
          </button>
          <button
            onClick={onCheckout}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            <ShoppingBag className="h-4 w-4" /> {t.cart.checkout}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted">{t.cart.deliveryNote}</p>
        </div>
      )}
    </Sheet>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="h-2 w-2 animate-bounce rounded-full bg-muted/50"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
