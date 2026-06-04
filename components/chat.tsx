"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { ArrowUp, Flower2, Gift, Loader2, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import {
  CategoryChips,
  DeliveryQuoteCard,
  OrderSummaryCard,
  ProductDetailCard,
  ProductGrid,
  TrackingTimeline,
  type AskFn,
} from "@/components/cards";
import type {
  CategoryList,
  DeliveryQuote,
  OrderConfirmation,
  OrderTracking,
  ProductDetail,
  SearchResults,
} from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";
import { cartCount, cartSubtotal, useCart } from "@/lib/cart/store";

/* part shapes we read off UIMessage.parts */
type AnyPart = {
  type: string;
  text?: string;
  state?: string;
  output?: unknown;
};

const TOOL_STATUS: Record<string, string> = {
  searchProducts: "Searching the Kapruka catalogue…",
  getProduct: "Fetching the details…",
  listCategories: "Browsing categories…",
  listDeliveryCities: "Looking up delivery areas…",
  checkDelivery: "Checking delivery…",
  createOrder: "Preparing your order…",
  trackOrder: "Tracking your order…",
};

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

function ToolView({ name, output, onAsk }: { name: string; output: unknown; onAsk: AskFn }) {
  const n = noteOf(output);
  if (n?.error) {
    return <p className="my-1 text-xs text-[#b4503f]">I couldn&apos;t complete that — {n.error}</p>;
  }

  switch (name) {
    case "searchProducts":
      return (output as SearchResults).results?.length ? (
        <ProductGrid data={output as SearchResults} onAsk={onAsk} />
      ) : null;
    case "getProduct":
      return (output as ProductDetail).id ? (
        <ProductDetailCard product={output as ProductDetail} />
      ) : null;
    case "listCategories":
      return <CategoryChips data={output as CategoryList} onAsk={onAsk} />;
    case "checkDelivery":
      return typeof (output as DeliveryQuote).available === "boolean" ? (
        <DeliveryQuoteCard quote={output as DeliveryQuote} />
      ) : null;
    case "createOrder":
      return (output as OrderConfirmation).checkout_url ? (
        <OrderSummaryCard order={output as OrderConfirmation} />
      ) : null;
    case "trackOrder":
      return (output as OrderTracking).order_number ? (
        <TrackingTimeline order={output as OrderTracking} />
      ) : null;
    case "listDeliveryCities": {
      const cities = (output as { cities?: { name: string }[] }).cities ?? [];
      if (!cities.length) return null;
      return (
        <div className="my-1 flex flex-wrap gap-1.5">
          {cities.slice(0, 12).map((c) => (
            <button
              key={c.name}
              onClick={() => onAsk(`Can you deliver to ${c.name}?`)}
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
          if (part.type === "text" && part.text) {
            return (
              <p key={i} className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                {part.text}
              </p>
            );
          }
          if (part.type.startsWith("tool-")) {
            const name = part.type.slice(5);
            if (part.state === "output-available") {
              return <ToolView key={i} name={name} output={part.output} onAsk={onAsk} />;
            }
            if (part.state === "output-error") {
              return (
                <p key={i} className="text-xs text-[#b4503f]">
                  Something went wrong with that step.
                </p>
              );
            }
            return (
              <div
                key={i}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-xs text-muted"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                {TOOL_STATUS[name] ?? "Working…"}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

const OCCASIONS = [
  "Birthday",
  "Anniversary",
  "Avurudu",
  "Get well soon",
  "Love & romance",
  "New baby",
  "Just because",
];

const EXAMPLES = [
  "Birthday flowers for my amma in Colombo, under Rs 6,000",
  "A cake delivered to Kandy this Friday",
  "A romantic anniversary gift with chocolates",
];

function Welcome({ onPick }: { onPick: AskFn }) {
  return (
    <div className="animate-rise flex flex-col items-center px-2 pt-10 text-center sm:pt-16">
      <Avatar size="lg" />
      <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
        Ayubowan! I&apos;m <span className="italic text-brand-dark">Malee</span> 🌸
      </h2>
      <p className="mt-2 max-w-md text-[15px] text-muted">
        Your Kapruka gift concierge. Tell me who you&apos;re spoiling and where it&apos;s going —
        I&apos;ll find something lovely and get it delivered anywhere in Sri Lanka.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {OCCASIONS.map((o) => (
          <button
            key={o}
            onClick={() => onPick(`I'm looking for a ${o.toLowerCase()} gift.`)}
            className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium text-ink shadow-sm transition hover:border-brand hover:text-brand-dark"
          >
            {o}
          </button>
        ))}
      </div>

      <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-1">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => onPick(ex)}
            className="group flex items-center gap-3 rounded-xl border border-line bg-card/70 px-4 py-3 text-left text-sm text-ink transition hover:border-brand hover:bg-card"
          >
            <Flower2 className="h-4 w-4 shrink-0 text-accent" />
            <span className="flex-1">&ldquo;{ex}&rdquo;</span>
            <ArrowUp className="h-4 w-4 rotate-45 text-muted transition group-hover:text-brand" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Composer({ onSend, disabled }: { onSend: AskFn; disabled: boolean }) {
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
    <div className="border-t border-line bg-cream/80 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-card p-2 shadow-sm focus-within:border-brand">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            placeholder="Message Malee… (e.g. flowers for my amma in Galle)"
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
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-muted/70"
          />
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-dark disabled:opacity-40"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted/80">
          Malee searches the live Kapruka catalogue, quotes delivery, and can place your order.
        </p>
      </div>
    </div>
  );
}

export function ChatShell() {
  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";
  const [cartOpen, setCartOpen] = useState(false);
  // Send the live cart with every turn so Malee always knows what to order.
  const ask: AskFn = (text) =>
    void sendMessage({ text }, { body: { cart: useCart.getState().items } });

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const lastIsAssistant = messages[messages.length - 1]?.role === "assistant";

  return (
    <div className="flex h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-cream/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Avatar />
          <div className="leading-tight">
            <div className="font-display text-lg">Malee</div>
            <div className="text-[11px] text-muted">Kapruka Gift Concierge</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand-dark sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Live catalogue
            </span>
            <CartButton onClick={() => setCartOpen(true)} />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
          {messages.length === 0 ? (
            <Welcome onPick={ask} />
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
                {error?.message || "Something went wrong."}{" "}
                <button
                  onClick={() => void regenerate()}
                  className="font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <Composer onSend={ask} disabled={busy} />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false);
          ask("I'm ready to check out and send these gifts — let's do it.");
        }}
      />
    </div>
  );
}

function CartButton({ onClick }: { onClick: () => void }) {
  const count = useCart((s) => cartCount(s.items));
  return (
    <button
      onClick={onClick}
      aria-label="Open your gift cart"
      className="relative flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm font-medium text-ink transition hover:border-brand"
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="hidden sm:inline">Gift</span>
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
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}) {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const subtotal = cartSubtotal(items);
  const currency = items[0]?.price?.currency ?? "LKR";

  return (
    <div
      className={cn(
        "fixed inset-0 z-30",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/30 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-cream shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Gift className="h-4 w-4 text-brand" />
          <span className="font-display text-lg">Your gift</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-full p-1 text-muted hover:bg-black/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center text-muted">
            <ShoppingBag className="h-8 w-8 opacity-40" />
            <p className="text-sm">
              Your gift is empty. Ask Malee for ideas, then tap{" "}
              <span className="font-medium text-ink">Add to gift</span>.
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
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
                      aria-label="Decrease quantity"
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-line hover:bg-black/5"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-sm">{i.quantity}</span>
                    <button
                      onClick={() => setQty(i.id, i.quantity + 1)}
                      aria-label="Increase quantity"
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-line hover:bg-black/5"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => remove(i.id)}
                      aria-label="Remove"
                      className="ml-auto rounded-full p-1 text-muted hover:text-[#b4503f]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={clear}
              className="text-xs text-muted underline-offset-2 hover:underline"
            >
              Clear gift
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="border-t border-line p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="font-display text-lg text-brand-dark">
                {formatPrice(subtotal, currency)}
              </span>
            </div>
            <button
              onClick={onCheckout}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <Gift className="h-4 w-4" /> Check out with Malee
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">
              + delivery, calculated at checkout
            </p>
          </div>
        )}
      </aside>
    </div>
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
