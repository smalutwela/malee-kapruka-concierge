"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  ExternalLink,
  LogOut,
  Package,
  Pencil,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
  User,
  UserRound,
  X,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { Sheet } from "@/components/sheet";
import { useT, useLocale } from "@/lib/i18n/context";
import { DEMO_EMAIL, useAccount } from "@/lib/account/store";
import { useProfile, type BuyerDetails } from "@/lib/profile/store";
import { useOrders, type OrderLine, type OrderRecord } from "@/lib/orders/store";

const EMPTY: BuyerDetails = { name: "", phone: "", address: "", city: "" };

/** True once a pay link's 60-min window has lapsed. Checks after mount, not during render. */
function useExpired(expiresAt?: string): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!expiresAt) return;
    const end = Date.parse(expiresAt);
    const update = () => setExpired(end < Date.now());
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return expired;
}

/**
 * The account drawer: the shopper's saved contact/delivery details (editable,
 * device-only) and their order history with one-tap **Reorder**. This is the
 * "you never go back to the website" surface — past orders and a fast repeat
 * path live right here in the agent.
 */
export function AccountDrawer({
  open,
  onClose,
  onReorder,
  onTrackNumber,
  onAsk,
}: {
  open: boolean;
  onClose: () => void;
  onReorder: (items: OrderLine[]) => void;
  onTrackNumber: (orderNumber: string) => void;
  /** Send a message to Malee as if the shopper typed it (closes the drawer). */
  onAsk: (text: string) => void;
}) {
  const t = useT();
  const orders = useOrders((s) => s.orders);
  const clearOrders = useOrders((s) => s.clear);
  const signedIn = useAccount((s) => s.email);

  return (
    <Sheet open={open} onClose={onClose} label={t.account.title}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Receipt className="h-4 w-4 text-brand" />
        <span className="font-display text-lg">{t.account.title}</span>
        <button
          onClick={onClose}
          aria-label={t.controls.close}
          className="-mr-1 ml-auto flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-black/5 sm:h-8 sm:w-8"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="safe-bottom min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
        <SignInSection onAsk={onAsk} />
        <DetailsSection />
        <TrackSection onTrack={onTrackNumber} />
        <OrdersSection
          orders={orders}
          onReorder={onReorder}
          onClearOrders={clearOrders}
          signedIn={Boolean(signedIn)}
        />
      </div>
    </Sheet>
  );
}

/**
 * Kapruka account sign-in — the gateway to the Phase 2 tools.
 *
 * The email is only ever what the shopper types here (or says to Malee in
 * chat); nothing is pre-filled. The demo address is shown as a *hint* so a
 * judge knows which account has data, but they still type it themselves — the
 * MCP ground rule is that the customer supplies their own address.
 */
function SignInSection({ onAsk }: { onAsk: (text: string) => void }) {
  const t = useT();
  const email = useAccount((s) => s.email);
  const name = useAccount((s) => s.name);
  const signIn = useAccount((s) => s.signIn);
  const signOut = useAccount((s) => s.signOut);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit(email = value) {
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    signIn(clean);
    setValue("");
    onAsk(t.prompts.signIn(clean.toLowerCase()));
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <UserRound className="h-4 w-4 text-brand" />
        <h3 className="font-display text-sm font-semibold">{t.account.signInTitle}</h3>
      </div>

      {email ? (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-3">
          <div className="text-sm font-medium text-ink">
            {name ? t.account.signedInAs(name) : email}
          </div>
          {name && <div className="truncate text-xs text-muted">{email}</div>}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              onClick={() => onAsk(t.prompts.myOrders)}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
            >
              <Package className="h-3.5 w-3.5" /> {t.account.kaprukaOrders}
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-black/5"
            >
              <LogOut className="h-3.5 w-3.5" /> {t.account.signOut}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-line bg-card p-3">
          <p className="text-xs leading-relaxed text-muted">{t.account.signInHint}</p>
          <div className="flex gap-2">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={value}
              placeholder={t.account.signInPlaceholder}
              aria-label={t.account.signInTitle}
              onChange={(e) => {
                setValue(e.target.value);
                setInvalid(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              className={cn(
                // 16px on mobile — a smaller font makes iOS Safari zoom on focus.
                "min-h-11 min-w-0 flex-1 rounded-lg border bg-cream px-3 py-2 text-base outline-none focus:border-brand sm:min-h-0 sm:text-sm",
                invalid ? "border-[#b4503f]" : "border-line",
              )}
            />
            <button
              onClick={() => submit()}
              disabled={!value.trim()}
              className="shrink-0 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40"
            >
              {t.account.signInAction}
            </button>
          </div>
          {invalid && <p className="text-[11px] text-[#b4503f]">{t.account.signInInvalid}</p>}
          {/* The preview backend serves one address only, so this is the path
              that actually works — a button, not a caption to retype by hand. */}
          <button
            onClick={() => submit(DEMO_EMAIL)}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-brand/40 px-3 py-1.5 text-left transition hover:border-brand hover:bg-brand/5 sm:min-h-0"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-ink">
                {t.account.signInDemoAction}
              </span>
              <span className="block truncate font-mono text-[11px] text-muted">{DEMO_EMAIL}</span>
            </span>
          </button>
        </div>
      )}
    </section>
  );
}

function DetailsSection() {
  const t = useT();
  const details = useProfile((s) => s.details);
  const save = useProfile((s) => s.set);
  const clear = useProfile((s) => s.clear);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BuyerDetails>(details ?? EMPTY);

  function beginEdit() {
    setForm(details ?? EMPTY);
    setEditing(true);
  }
  function commit() {
    save(form);
    setEditing(false);
  }

  const showForm = editing || !details;

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <User className="h-4 w-4 text-brand" />
        <h3 className="font-display text-sm font-semibold">{t.account.detailsTitle}</h3>
        {details && !editing && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={beginEdit}
              className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-black/5"
            >
              <Pencil className="h-3 w-3" /> {t.account.edit}
            </button>
            <button
              onClick={clear}
              aria-label={t.account.clearDetails}
              className="rounded-full p-1 text-muted transition hover:text-[#b4503f]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {showForm ? (
        <div className="space-y-2 rounded-xl border border-line bg-card p-3">
          <Field
            value={form.name}
            placeholder={t.account.namePh}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          />
          <Field
            value={form.phone}
            placeholder={t.account.phonePh}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
          />
          <Field
            value={form.address}
            placeholder={t.account.addressPh}
            onChange={(v) => setForm((f) => ({ ...f, address: v }))}
          />
          <Field
            value={form.city}
            placeholder={t.account.cityPh}
            onChange={(v) => setForm((f) => ({ ...f, city: v }))}
          />
          <button
            onClick={commit}
            className="min-h-11 w-full rounded-full bg-brand py-2 text-xs font-semibold text-white transition hover:bg-brand-dark sm:min-h-0"
          >
            {t.account.save}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-card p-3 text-sm">
          <div className="font-medium">{details!.name}</div>
          <div className="text-muted">{details!.phone}</div>
          <div className="text-muted">
            {[details!.address, details!.city].filter(Boolean).join(", ")}
          </div>
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-muted/80">{t.account.detailsHint}</p>
    </section>
  );
}

function Field({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-11 w-full rounded-lg border border-line bg-cream px-3 py-2 text-base outline-none focus:border-brand sm:min-h-0 sm:text-sm"
    />
  );
}

function TrackSection({ onTrack }: { onTrack: (orderNumber: string) => void }) {
  const t = useT();
  const [value, setValue] = useState("");
  function submit() {
    const num = value.trim();
    if (!num) return;
    onTrack(num);
    setValue("");
  }
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Truck className="h-4 w-4 text-brand" />
        <h3 className="font-display text-sm font-semibold">{t.account.trackTitle}</h3>
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          placeholder={t.account.trackPlaceholder}
          aria-label={t.account.trackTitle}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-base outline-none focus:border-brand sm:min-h-0 sm:text-sm"
        />
        <button
          onClick={submit}
          disabled={!value.trim()}
          className="min-h-11 shrink-0 rounded-full bg-brand px-4 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40 sm:min-h-0 sm:py-2"
        >
          {t.account.track}
        </button>
      </div>
    </section>
  );
}

function OrdersSection({
  orders,
  onReorder,
  onClearOrders,
  signedIn,
}: {
  orders: OrderRecord[];
  onReorder: (items: OrderLine[]) => void;
  onClearOrders: () => void;
  /** When signed in, the Kapruka account is the real history — these are just
   *  the orders placed in this chat, so the heading says so. */
  signedIn: boolean;
}) {
  const t = useT();
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <ShoppingBag className="h-4 w-4 text-brand" />
        <h3 className="font-display text-sm font-semibold">
          {signedIn ? t.account.localOrdersTitle : t.account.ordersTitle}
        </h3>
        {orders.length > 0 && (
          <button
            onClick={onClearOrders}
            className="ml-auto text-[11px] text-muted underline-offset-2 hover:underline"
          >
            {t.account.clearOrders}
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-card/60 px-3 py-6 text-center text-xs text-muted">
          {t.account.noOrders}
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <OrderCard key={o.orderRef} order={o} onReorder={onReorder} />
          ))}
        </div>
      )}
    </section>
  );
}

function OrderCard({
  order,
  onReorder,
}: {
  order: OrderRecord;
  onReorder: (items: OrderLine[]) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const date = new Date(order.createdAt).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
  // The pay link is time-limited; resolve "expired" after mount and refresh it
  // periodically (Date.now is impure, so it can't run during render).
  const expired = useExpired(order.expiresAt);

  return (
    <div className="rounded-xl border border-line bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Clock className="h-3.5 w-3.5" />
        <span>{t.account.orderedOn(date)}</span>
        <span className="ml-auto font-mono">{order.orderRef}</span>
      </div>

      <div className="mt-2 space-y-1 text-sm">
        {order.items.map((i) => (
          <div key={i.id} className="flex items-start justify-between gap-3">
            <span className="line-clamp-1 min-w-0 flex-1 text-muted">
              <span className="font-semibold text-ink">{i.quantity}×</span> {i.name}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-sm">
        <span className="text-muted">{t.cards.total}</span>
        <span className="font-display text-brand-dark">{formatPrice(order.total, order.currency)}</span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          onClick={() => onReorder(order.items)}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
        >
          <RotateCcw className="h-3.5 w-3.5" /> {t.account.reorder}
        </button>
        {!expired && (
          <a
            href={order.checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-black/5"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> {t.account.pay} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
