"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  ExternalLink,
  Flower2,
  Gift,
  Globe,
  MapPin,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { cn, formatPrice, resizeImage } from "@/lib/utils";
import { useCart } from "@/lib/cart/store";
import { useT } from "@/lib/i18n/context";
import type {
  CategoryList,
  DeliveryQuote,
  Money,
  OrderConfirmation,
  OrderTracking,
  ProductDetail,
  ProductSummary,
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
      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-black/5"
    >
      {children}
    </button>
  );
}

function AddToGift({
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
        "inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition",
        added ? "bg-brand-dark" : "bg-brand hover:bg-brand-dark",
      )}
    >
      {added ? (
        <>
          <Check className="h-3.5 w-3.5" /> {t.cards.added}
        </>
      ) : (
        <>
          <Gift className="h-3.5 w-3.5" /> {t.cards.addToGift}
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
          <AddToGift item={{ id, name, price, image: image_url }} />
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
  const hero = resizeImage(product.images?.[0], 640) ?? product.images?.[0];
  return (
    <div className="animate-rise my-2 overflow-hidden rounded-2xl border border-line bg-card shadow-sm sm:flex">
      <SmartImage src={hero} alt={product.name} className="aspect-square w-full sm:w-56 sm:shrink-0" />
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
          <AddToGift item={{ id: product.id, name: product.name, price: product.price, image: hero }} />
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

/* ----------------------------- order (pay link) ----------------------------- */

function useCountdown(expiresAt?: string) {
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    if (!expiresAt) return;
    const end = new Date(expiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, end - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return { expired: remaining <= 0, label: `${mins}:${secs.toString().padStart(2, "0")}` };
}

export function OrderSummaryCard({ order }: { order: OrderConfirmation }) {
  const t = useT();
  const { expired, label } = useCountdown(order.expires_at);
  const s = order.summary;
  return (
    <div className="animate-rise my-2 overflow-hidden rounded-2xl border border-brand/30 bg-card shadow-md">
      <div className="flex items-center gap-2 bg-brand px-4 py-2.5 text-white">
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-semibold">{t.cards.orderReady}</span>
        <span className="ml-auto font-mono text-xs opacity-90">{order.order_ref}</span>
      </div>
      <div className="space-y-1.5 p-4 text-sm">
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

export function TrackingTimeline({ order }: { order: OrderTracking }) {
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
      {order.progress && order.progress.length > 0 && (
        <ol className="mt-3 space-y-3">
          {order.progress.map((step, i) => {
            const done = i < order.progress!.length;
            return (
              <li key={i} className="flex gap-3">
                <span
                  className={cn(
                    "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    done ? "bg-brand" : "bg-line",
                  )}
                />
                <div className="text-sm">
                  <div className="font-medium">{step.step}</div>
                  <div className="text-xs text-muted">{step.timestamp}</div>
                </div>
              </li>
            );
          })}
        </ol>
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
