"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  CircleAlert,
  Clock,
  ExternalLink,
  Flower2,
  Globe,
  House,
  Mail,
  MapPin,
  Package,
  PackageCheck,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { cn, formatPrice, resizeImage } from "@/lib/utils";
import { useCart } from "@/lib/cart/store";
import { useOrders } from "@/lib/orders/store";
import { useLocale, useT } from "@/lib/i18n/context";
import type {
  AccountOrder,
  AccountOrderHistory,
  AddressBook,
  AddToCartToolOutput,
  CategoryList,
  CreateOrderToolInput,
  CustomerProfile,
  DeliveryQuote,
  Money,
  OrderConfirmation,
  OrderTracking,
  ProductDetail,
  ProductSummary,
  ReorderPlan,
  SearchResults,
} from "@/lib/types";

export type AskFn = (text: string) => void;

/* ----------------------------- primitives ----------------------------- */

function Badge({
  children,
  tone = "brand",
  className,
}: {
  children: React.ReactNode;
  tone?: "brand" | "accent" | "muted" | "rose";
  className?: string;
}) {
  const tones = {
    brand: "bg-brand/10 text-brand-dark",
    accent: "bg-accent-soft text-accent",
    muted: "bg-black/5 text-muted",
    rose: "bg-blush text-[#9c4a3c]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

function StockBadge({ inStock, level }: { inStock?: boolean; level?: string }) {
  const t = useT();
  if (inStock === false) return <Badge tone="muted">{t.cards.outOfStock}</Badge>;
  if (level === "low") return <Badge tone="accent">{t.cards.lowStock}</Badge>;
  return (
    <Badge tone="brand">
      <Check className="h-3 w-3" /> {t.cards.inStock}
    </Badge>
  );
}

function SmartImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-blush text-accent/50", className)}>
        <Flower2 className="h-8 w-8" />
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-blush", className)}>
      {!loaded && <div className="skeleton absolute inset-0" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

function Price({
  price,
  compareAt,
  className,
}: {
  price?: { amount: number | null; currency: string };
  compareAt?: { amount: number | null; currency: string } | null;
  className?: string;
}) {
  const showCompare =
    compareAt?.amount != null && price?.amount != null && compareAt.amount > price.amount;
  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="font-semibold text-brand-dark">
        {formatPrice(price?.amount, price?.currency)}
      </span>
      {showCompare && (
        <span className="text-xs text-muted line-through">
          {formatPrice(compareAt!.amount, compareAt!.currency)}
        </span>
      )}
    </div>
  );
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      // min-h-10 on touch: these sit on the product card, the most-tapped
      // control in the app. Back to the compact pill from `sm` up.
      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-black/5 sm:min-h-0"
    >
      {children}
    </button>
  );
}

function AddToCart({
  item,
}: {
  item: { id: string; name: string; price?: Money; image?: string | null };
}) {
  const t = useT();
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  return (
    <button
      onClick={() => {
        add(item);
        setAdded(true);
        setTimeout(() => setAdded(false), 1600);
      }}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition sm:min-h-0",
        added ? "bg-brand-dark" : "bg-brand hover:bg-brand-dark",
      )}
    >
      {added ? (
        <>
          <Check className="h-3.5 w-3.5" /> {t.cards.added}
        </>
      ) : (
        <>
          <ShoppingBag className="h-3.5 w-3.5" /> {t.cards.addToCart}
        </>
      )}
    </button>
  );
}

/* ----------------------------- product cards ----------------------------- */

export function ProductCard({ product, onAsk }: { product: ProductSummary; onAsk?: AskFn }) {
  const t = useT();
  const { id, name, price, compare_at_price, in_stock, stock_level, image_url, category } = product;
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative">
        <SmartImage src={image_url} alt={name} className="aspect-square w-full" />
        <div className="absolute left-2 top-2">
          <StockBadge inStock={in_stock} level={stock_level} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {category?.name && category.name !== "General" && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            {category.name}
          </span>
        )}
        <h3 className="font-display text-[15px] leading-snug line-clamp-2">{name}</h3>
        <Price price={price} compareAt={compare_at_price} className="mt-auto" />
        <div className="mt-1 flex flex-wrap gap-2">
          <AddToCart item={{ id, name, price, image: image_url }} />
          <GhostButton onClick={() => onAsk?.(t.prompts.productDetails(id, name))}>
            {t.cards.details}
          </GhostButton>
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({ data, onAsk }: { data: SearchResults; onAsk?: AskFn }) {
  const results = data.results ?? [];
  if (!results.length) return null;
  return (
    <div className="animate-rise my-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {results.map((p) => (
        <ProductCard key={p.id} product={p} onAsk={onAsk} />
      ))}
    </div>
  );
}

export function ProductDetailCard({ product }: { product: ProductDetail }) {
  const t = useT();
  const images = product.images ?? [];
  const [heroIdx, setHeroIdx] = useState(0);
  const heroSrc = images[Math.min(heroIdx, Math.max(images.length - 1, 0))];
  const hero = resizeImage(heroSrc, 640) ?? heroSrc;
  return (
    <div className="animate-rise my-2 overflow-hidden rounded-2xl border border-line bg-card shadow-sm sm:flex">
      <div className="sm:w-56 sm:shrink-0">
        {/* key remounts SmartImage per image so the loading skeleton resets */}
        <SmartImage key={hero} src={hero} alt={product.name} className="aspect-square w-full" />
        {images.length > 1 && (
          <div className="flex gap-1.5 p-2">
            {images.slice(0, 4).map((img, i) => (
              <button
                key={i}
                onClick={() => setHeroIdx(i)}
                aria-label={`${product.name} ${i + 1}`}
                className={cn(
                  "h-12 w-12 overflow-hidden rounded-lg border transition",
                  i === heroIdx ? "border-brand ring-1 ring-brand" : "border-line opacity-70 hover:opacity-100",
                )}
              >
                <SmartImage src={resizeImage(img, 128) ?? img} alt="" className="h-full w-full" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <StockBadge inStock={product.in_stock} level={product.stock_level} />
          {product.shipping?.ships_internationally && (
            <Badge tone="muted">
              <Globe className="h-3 w-3" /> {t.cards.shipsWorldwide}
            </Badge>
          )}
        </div>
        <h3 className="font-display text-lg leading-tight">{product.name}</h3>
        <Price price={product.price} compareAt={product.compare_at_price} />
        {product.summary && (
          <p className="line-clamp-3 text-sm text-muted">{product.summary}</p>
        )}
        {product.variants && product.variants.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {product.variants.slice(0, 6).map((v) => (
              <span key={v.id} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                {v.name}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <AddToCart item={{ id: product.id, name: product.name, price: product.price, image: hero }} />
          {product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-black/5"
            >
              {t.cards.viewOnKapruka} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- delivery ----------------------------- */

export function DeliveryQuoteCard({ quote }: { quote: DeliveryQuote }) {
  const t = useT();
  return (
    <div className="animate-rise my-2 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Truck className="h-4 w-4 text-brand" />
        {t.cards.deliveryTo(quote.city)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          {quote.available ? (
            <Check className="h-4 w-4 text-brand" />
          ) : (
            <X className="h-4 w-4 text-[#b4503f]" />
          )}
          <span>
            {quote.checked_date}
            {quote.available ? ` · ${t.cards.available}` : ` · ${t.cards.notAvailable}`}
          </span>
        </div>
        {quote.rate != null && (
          <div>
            <span className="text-muted">{t.cards.deliveryFee} </span>
            <span className="font-semibold text-brand-dark">
              {formatPrice(quote.rate, quote.currency ?? "LKR")}
            </span>
          </div>
        )}
      </div>
      {!quote.available && quote.next_available_date && (
        <p className="mt-2 text-sm text-muted">
          {t.cards.nextAvailable}{" "}
          <span className="font-medium text-ink">{quote.next_available_date}</span>
          {quote.reason ? ` — ${quote.reason}` : ""}
        </p>
      )}
      {quote.perishable_warning && (
        <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          🌸 {quote.perishable_warning}
        </p>
      )}
    </div>
  );
}

/* ----------------------------- cart add (agent) ----------------------------- */

/**
 * Confirmation row for an agent-side addToCart. The actual cart mutation happens
 * in useCaptureCartAdds (store-side, deduped by addId) — this card only renders
 * the tool result, so it stays honest even on a restored transcript.
 */
export function CartAddCard({ data }: { data: AddToCartToolOutput }) {
  const t = useT();
  const item = data.item;
  if (!item) return null;
  const qty = data.quantity ?? 1;
  return (
    <div className="animate-rise my-2 flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5 pr-4 shadow-sm">
      <SmartImage
        src={resizeImage(item.image ?? undefined, 96)}
        alt={item.name}
        className="h-12 w-12 shrink-0 rounded-xl"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.name}</p>
        <p className="text-xs text-muted">
          {qty}×{item.price?.amount != null ? ` · ${formatPrice(item.price.amount * qty, item.price.currency)}` : ""}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
        <Check className="h-3.5 w-3.5" />
        {t.cards.addedToCart}
      </span>
    </div>
  );
}

/* ----------------------------- order (pay link) ----------------------------- */

function useCountdown(expiresAt?: string) {
  // `remaining` starts unknown (null) and resolves after mount — Date.now can't
  // run during render, and starting at 0 would flash "expired" on first paint.
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const end = new Date(expiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, end - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const mins = Math.floor((remaining ?? 0) / 60000);
  const secs = Math.floor(((remaining ?? 0) % 60000) / 1000);
  return {
    expired: remaining !== null && remaining <= 0,
    label: remaining === null ? "…" : `${mins}:${secs.toString().padStart(2, "0")}`,
  };
}

export function OrderSummaryCard({
  order,
  input,
}: {
  order: OrderConfirmation;
  input?: CreateOrderToolInput;
}) {
  const t = useT();
  const { expired, label } = useCountdown(order.expires_at);
  const s = order.summary;
  // Itemise what was ACTUALLY ordered — the createOrder response has totals
  // only. The captured order record (lib/orders) is richest (names, prices,
  // images survive reloads); until it lands, fall back to the tool input's
  // cart lines enriched from the live cart, snapshotted at mount so later cart
  // edits never rewrite a placed order.
  const record = useOrders((st) => st.orders.find((o) => o.orderRef === order.order_ref));
  const [fallbackLines] = useState(() => {
    const cartItems = useCart.getState().items;
    return (input?.cart ?? []).map((line) => {
      const known = cartItems.find((c) => c.id === line.productId);
      return {
        id: line.productId,
        name: known?.name ?? line.name ?? line.productId,
        quantity: line.quantity ?? 1,
        // Direct (cart-less) orders enrich from the model-passed unit price.
        price:
          known?.price ??
          (line.unitPrice != null ? { amount: line.unitPrice, currency: s.currency } : undefined),
      };
    });
  });
  const lines = record?.items ?? fallbackLines;
  const gift = input?.giftMessage?.trim();
  const giftSender = input?.sender?.anonymous ? "Anonymous" : input?.sender?.name?.trim();
  return (
    <div className="animate-rise my-2 overflow-hidden rounded-2xl border border-brand/30 bg-card shadow-md">
      <div className="flex items-center gap-2 bg-brand px-4 py-2.5 text-white">
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-semibold">{t.cards.orderReady}</span>
        <span className="ml-auto font-mono text-xs opacity-90">{order.order_ref}</span>
      </div>
      <div className="space-y-1.5 p-4 text-sm">
        {lines.length > 0 && (
          <div className="space-y-1.5 pb-1">
            {lines.map((i) => (
              <div key={i.id} className="flex items-start justify-between gap-3">
                <span className="line-clamp-2 min-w-0 flex-1 leading-snug text-muted">
                  <span className="font-semibold text-ink">{i.quantity}×</span> {i.name}
                </span>
                {i.price?.amount != null && (
                  <span className="shrink-0 tabular-nums">
                    {formatPrice(i.price.amount * i.quantity, i.price.currency ?? s.currency)}
                  </span>
                )}
              </div>
            ))}
            <div className="my-1 border-t border-line" />
          </div>
        )}
        {gift && (
          <div className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
            💌 “{gift}”
            {giftSender ? <span className="opacity-80"> — {giftSender}</span> : null}
          </div>
        )}
        <Row label={t.cards.items} value={formatPrice(s.items_total, s.currency)} />
        <Row label={t.cards.delivery} value={formatPrice(s.delivery_fee, s.currency)} />
        {s.addons_total > 0 && (
          <Row label={t.cards.addons} value={formatPrice(s.addons_total, s.currency)} />
        )}
        <div className="my-1 border-t border-line" />
        <Row label={t.cards.total} value={formatPrice(s.grand_total, s.currency)} emphasize />
        <a
          href={order.checkout_url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "mt-3 flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white transition",
            expired ? "cursor-not-allowed bg-muted" : "bg-brand hover:bg-brand-dark",
          )}
          aria-disabled={expired}
        >
          <ShoppingBag className="h-4 w-4" />
          {expired ? t.cards.linkExpired : t.cards.paySecurely}
          {!expired && <ExternalLink className="h-4 w-4" />}
        </a>
        <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[11px] text-muted">
          <Clock className="h-3 w-3" />
          {expired ? t.cards.freshLink : t.cards.priceLocked(label)}
        </p>
        <p className="text-center text-[11px] text-muted/80">{t.cards.guestCheckoutNote}</p>
      </div>
    </div>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={emphasize ? "font-semibold" : "text-muted"}>{label}</span>
      <span className={emphasize ? "font-display text-lg text-brand-dark" : ""}>{value}</span>
    </div>
  );
}

/* ----------------------------- tracking ----------------------------- */

/**
 * Kapruka's tracking payload is loosely typed: money fields arrive as a plain
 * string, a number, or {value, currency} with a STRING value. Normalize to a
 * display string (or null to hide) — rendering the raw object crashes React.
 */
function moneyText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return formatPrice(v);
  if (typeof v === "object") {
    const o = v as { value?: string | number; currency?: string };
    const n = Number(o.value);
    if (Number.isFinite(n)) return formatPrice(n, o.currency ?? "LKR");
  }
  return null;
}

/** Icon for a tracking step, keyed off the step's wording. */
function stepIcon(step: string) {
  const s = step.toLowerCase();
  if (/(deliver|hand|received)/.test(s)) return PackageCheck;
  if (/(dispatch|vehicle|transit|courier|out for|left|route|driver)/.test(s)) return Truck;
  if (/(pack|prepar|process|bake|pick)/.test(s)) return ShoppingBag;
  return Check; // placed / confirmed / paid
}

/**
 * Kapruka's tracking is genuinely detailed ("from the time the vehicle left") —
 * visualize it as a stepper: every reported step is done, the newest one is the
 * live "current" stop, plus the order's items and key facts. The delivered
 * state renders fully settled (no pulse).
 */
export function TrackingTimeline({ order }: { order: OrderTracking }) {
  const t = useT();
  const steps = order.progress ?? [];
  const delivered = /deliver/i.test(`${order.status} ${order.status_display ?? ""}`);
  const amount = moneyText(order.amount);
  // payment_method is often a junk code ("0000") — show it only if it reads like a word.
  const payment = /[a-z]/i.test(order.payment_method ?? "") ? order.payment_method : null;
  const meta = [
    order.delivery_date ? { icon: Truck, text: `${t.cards.delivery}: ${order.delivery_date}` } : null,
    amount ? { icon: Sparkles, text: amount } : null,
    payment ? { icon: Check, text: payment } : null,
  ].filter(Boolean) as { icon: typeof Check; text: string }[];

  return (
    <div className="animate-rise my-2 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <PackageCheck className="h-4 w-4 text-brand" />
        <span className="font-mono text-sm font-semibold">{order.order_number}</span>
        <Badge tone="brand" className="ml-auto">
          {order.status_display ?? order.status}
        </Badge>
      </div>
      {order.recipient && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5" /> {order.recipient.name} · {order.recipient.city}
        </p>
      )}
      {meta.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {meta.map((m, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted"
            >
              <m.icon className="h-3 w-3" /> {m.text}
            </span>
          ))}
        </div>
      )}
      {steps.length > 0 && (
        <ol className="relative mt-4 space-y-0">
          {steps.map((step, i) => {
            const Icon = stepIcon(step.step);
            const current = i === steps.length - 1 && !delivered;
            const last = i === steps.length - 1;
            return (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {!last && (
                  <span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 bg-brand/30" />
                )}
                <span
                  className={cn(
                    "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    current ? "bg-brand text-white shadow-md" : "bg-brand/15 text-brand",
                  )}
                >
                  {current && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-brand/40" />
                  )}
                  <Icon className="relative h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 pt-0.5 text-sm">
                  <div className={cn("font-medium", current && "text-brand-dark")}>{step.step}</div>
                  <div className="text-xs text-muted">{step.timestamp}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {order.items && order.items.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          {order.items.map((i, idx) => {
            const price = moneyText(i.selling_price);
            return (
              <div key={idx} className="flex items-start justify-between gap-3">
                <span className="line-clamp-1 min-w-0 flex-1 text-muted">
                  <span className="font-semibold text-ink">{i.quantity}×</span> {i.name}
                </span>
                {price && <span className="shrink-0 tabular-nums text-muted">{price}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Kapruka account ----------------------------- */

/**
 * Render an ISO date from the account tools. Built from explicit parts rather
 * than `new Date("2026-08-03")`, which is parsed as UTC midnight and would show
 * the previous day for any viewer west of Greenwich.
 */
function useIsoDate(iso: string | null): string | null {
  const { locale } = useLocale();
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

/** Status pill colour, keyed off the normalized status slug. */
function statusTone(key: string): "brand" | "accent" | "muted" | "rose" {
  if (/deliver|complete/.test(key)) return "brand";
  if (/cancel|fail|reject|refund/.test(key)) return "rose";
  if (/process|prepar|transit|ship|dispatch|pending/.test(key)) return "accent";
  return "muted";
}

/**
 * The "welcome back" moment — a real Kapruka customer, recognised. This is the
 * card that turns a cold chat into a returning-customer experience.
 */
export function AccountProfileCard({ customer }: { customer: CustomerProfile }) {
  const t = useT();
  const name = customer.fullName ?? customer.firstName ?? customer.email;
  return (
    <div className="animate-rise my-2 overflow-hidden rounded-2xl border border-brand/30 bg-card shadow-sm">
      <div className="flex items-center gap-3 bg-gradient-to-r from-brand to-accent px-4 py-3 text-white">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
          <UserRound className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="truncate font-display text-base leading-tight">
            {t.cards.welcomeBack(name)}
          </div>
          <div className="text-[11px] opacity-90">{t.cards.accountVerified}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-4 py-3 text-xs text-muted">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{customer.email}</span>
        </span>
        {customer.phone && (
          <span className="inline-flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 shrink-0" />
            {customer.phone}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Real Kapruka order history: every past order with its status, what was in it,
 * and one tap to either track it or buy it again. This is the "where is my
 * order?" and "get me my usual" surface, sourced from the account rather than
 * from anything this browser happens to remember.
 */
export function OrderHistoryCard({
  history,
  onAsk,
}: {
  history: AccountOrderHistory;
  onAsk?: AskFn;
}) {
  const t = useT();
  const orders = history.orders ?? [];
  if (!orders.length) return null;
  return (
    <div className="animate-rise my-2 space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Package className="h-4 w-4 text-brand" />
        <span className="font-display text-sm font-semibold">{t.cards.yourOrders}</span>
        <span className="ml-auto text-[11px] text-muted">{t.cards.orderCount(orders.length)}</span>
      </div>
      {orders.map((o) => (
        <AccountOrderRow key={o.reference} order={o} onAsk={onAsk} />
      ))}
    </div>
  );
}

function AccountOrderRow({ order, onAsk }: { order: AccountOrder; onAsk?: AskFn }) {
  const t = useT();
  const ordered = useIsoDate(order.orderedAt);
  const delivery = useIsoDate(order.deliveryDate);
  return (
    <div className="rounded-2xl border border-line bg-card p-3.5 shadow-sm transition hover:border-brand/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-ink">{order.reference}</span>
        <Badge tone={statusTone(order.statusKey)}>{order.statusLabel}</Badge>
        {order.total != null && (
          <span className="ml-auto font-display text-sm text-brand-dark">
            {formatPrice(order.total, order.currency)}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {ordered && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {t.cards.orderedLabel} {ordered}
          </span>
        )}
        {delivery && (
          <span className="inline-flex items-center gap-1">
            <Truck className="h-3 w-3" /> {t.cards.deliveryLabel} {delivery}
          </span>
        )}
        {order.recipient?.name && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {t.cards.sentTo(order.recipient.name)}
              {order.recipient.city ? ` · ${order.recipient.city}` : ""}
            </span>
          </span>
        )}
      </div>

      {order.items.length > 0 && (
        <div className="mt-2.5 space-y-1 border-t border-line pt-2.5 text-sm">
          {order.items.map((i) => (
            <div key={i.productId} className="flex items-start justify-between gap-3">
              <span className="line-clamp-1 min-w-0 flex-1 text-muted">
                <span className="font-semibold text-ink">{i.quantity}×</span> {i.name}
              </span>
              {i.lineTotal != null && (
                <span className="shrink-0 tabular-nums text-muted">
                  {formatPrice(i.lineTotal, i.currency)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {order.giftMessage && (
        <div className="mt-2 rounded-lg bg-accent-soft px-3 py-1.5 text-xs text-accent">
          💌 “{order.giftMessage}”
        </div>
      )}

      {onAsk && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            onClick={() => onAsk(t.prompts.trackNumber(order.reference))}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand-dark"
          >
            <PackageCheck className="h-3.5 w-3.5" /> {t.cards.trackThis}
          </button>
          {order.items.length > 0 && (
            <button
              onClick={() => onAsk(t.prompts.reorderRef(order.reference))}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
            >
              <RotateCcw className="h-3.5 w-3.5" /> {t.cards.buyAgain}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Saved delivery addresses — the single biggest friction-killer at checkout.
 * One tap tells Malee where it's going; nobody retypes a street they already
 * gave Kapruka.
 */
export function AddressBookCard({ book, onAsk }: { book: AddressBook; onAsk?: AskFn }) {
  const t = useT();
  const addresses = book.addresses ?? [];
  if (!addresses.length) return null;
  return (
    <div className="animate-rise my-2 space-y-2">
      <div className="flex items-center gap-2 px-1">
        <MapPin className="h-4 w-4 text-brand" />
        <span className="font-display text-sm font-semibold">{t.cards.savedAddresses}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {addresses.map((a) => {
          const Icon = a.label === "Home" ? House : a.label === "Office" ? Building2 : MapPin;
          return (
            <div
              key={a.id}
              className="flex flex-col rounded-2xl border border-line bg-card p-3 shadow-sm transition hover:border-brand/40"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-brand" />
                <span className="truncate text-sm font-semibold">{a.label}</span>
                <Badge tone={a.saved ? "brand" : "muted"} className="ml-auto shrink-0">
                  {a.saved ? t.cards.savedBadge : t.cards.recentBadge}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {a.name !== a.label && <span className="block text-ink">{a.name}</span>}
                {a.address}
                <br />
                {a.city}
                {a.phone ? ` · ${a.phone}` : ""}
              </p>
              {onAsk && (
                <button
                  onClick={() => onAsk(t.prompts.deliverToSaved(a.label, a.address, a.city))}
                  className="mt-2.5 inline-flex items-center justify-center gap-1.5 self-start rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand-dark"
                >
                  <Truck className="h-3.5 w-3.5" /> {t.cards.deliverHere}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A past order re-priced against today's catalogue. Honest about what changed:
 * price drift is shown as a struck-through "was", and anything discontinued or
 * out of stock is listed separately rather than quietly dropped.
 */
export function ReorderCard({ plan }: { plan: ReorderPlan }) {
  const t = useT();
  const addToCart = useCart((s) => s.add);
  const [addedAll, setAddedAll] = useState(false);
  const lines = plan.lines ?? [];
  const dropped = plan.unavailable ?? [];
  const ordered = useIsoDate(plan.orderedAt);
  const currency = plan.currency ?? lines[0]?.currency ?? "LKR";

  if (!lines.length && !dropped.length) return null;

  function addAll() {
    for (const l of lines) {
      addToCart(
        {
          id: l.productId,
          name: l.name,
          price: { amount: l.nowPrice, currency: l.currency },
          image: l.image,
        },
        l.quantity,
      );
    }
    setAddedAll(true);
    setTimeout(() => setAddedAll(false), 1800);
  }

  return (
    <div className="animate-rise my-2 overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <RotateCcw className="h-4 w-4 shrink-0 text-brand" />
        <span className="font-display text-sm font-semibold">
          {t.cards.reorderFrom(plan.reference)}
        </span>
        {ordered && <span className="text-[11px] text-muted">· {ordered}</span>}
        <span className="ml-auto text-[11px] text-muted">{t.cards.pricedToday}</span>
      </div>

      <div className="divide-y divide-line">
        {lines.map((l) => (
          <div key={l.productId} className="flex items-center gap-3 px-4 py-2.5">
            <SmartImage
              src={resizeImage(l.image ?? undefined, 96)}
              alt={l.name}
              className="h-12 w-12 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-medium text-ink">{l.name}</p>
              <p className="flex items-baseline gap-2 text-xs">
                <span className="font-semibold text-brand-dark">
                  {l.quantity}× {formatPrice(l.nowPrice, l.currency)}
                </span>
                {l.priceChanged && l.thenPrice != null && (
                  <span className="text-muted line-through">
                    {t.cards.wasPrice(formatPrice(l.thenPrice, l.currency))}
                  </span>
                )}
              </p>
            </div>
            <AddToCart
              item={{
                id: l.productId,
                name: l.name,
                price: { amount: l.nowPrice, currency: l.currency },
                image: l.image,
              }}
            />
          </div>
        ))}
      </div>

      {dropped.length > 0 && (
        <div className="border-t border-line bg-black/[0.02] px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <CircleAlert className="h-3.5 w-3.5" /> {t.cards.unavailableNow}
          </p>
          <ul className="mt-1 space-y-0.5">
            {dropped.map((d) => (
              <li key={d.productId} className="text-xs text-muted">
                <span className="line-through">{d.name}</span>{" "}
                <span className="opacity-70">
                  —{" "}
                  {d.reason === "out_of_stock" ? t.cards.outOfStockNow : t.cards.discontinued}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lines.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
          <div className="text-sm">
            <span className="text-muted">{t.cards.todaysTotal} </span>
            <span className="font-display text-lg text-brand-dark">
              {formatPrice(plan.nowTotal ?? null, currency)}
            </span>
          </div>
          <button
            onClick={addAll}
            className={cn(
              "ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white transition",
              addedAll ? "bg-brand-dark" : "bg-brand hover:bg-brand-dark",
            )}
          >
            {addedAll ? (
              <>
                <Check className="h-3.5 w-3.5" /> {t.cards.added}
              </>
            ) : (
              <>
                <ShoppingBag className="h-3.5 w-3.5" /> {t.cards.addAllToCart}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- categories ----------------------------- */

export function CategoryChips({ data, onAsk }: { data: CategoryList; onAsk?: AskFn }) {
  const t = useT();
  const cats = (data.categories ?? []).filter((c) => c.name && c.name.toLowerCase() !== "general");
  if (!cats.length) return null;
  return (
    <div className="animate-rise my-2 flex flex-wrap gap-2">
      {cats.slice(0, 14).map((c) => (
        <button
          key={c.name}
          onClick={() => onAsk?.(t.prompts.categoryIdeas(c.name))}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink transition hover:border-brand hover:text-brand-dark"
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
