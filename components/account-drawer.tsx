"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  ExternalLink,
  Pencil,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { useT, useLocale } from "@/lib/i18n/context";
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
  onTrack,
}: {
  open: boolean;
  onClose: () => void;
  onReorder: (items: OrderLine[]) => void;
  onTrack: () => void;
}) {
  const t = useT();
  const orders = useOrders((s) => s.orders);
  const clearOrders = useOrders((s) => s.clear);

  return (
    <div
      className={cn("fixed inset-0 z-30", open ? "pointer-events-auto" : "pointer-events-none")}
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
          <Receipt className="h-4 w-4 text-brand" />
          <span className="font-display text-lg">{t.account.title}</span>
          <button
            onClick={onClose}
            aria-label={t.controls.close}
            className="ml-auto rounded-full p-1 text-muted hover:bg-black/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <DetailsSection />
          <OrdersSection
            orders={orders}
            onReorder={onReorder}
            onTrack={onTrack}
            onClearOrders={clearOrders}
          />
        </div>
      </aside>
    </div>
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
            className="w-full rounded-full bg-brand py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
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
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-line bg-cream px-3 py-2 text-sm outline-none focus:border-brand"
    />
  );
}

function OrdersSection({
  orders,
  onReorder,
  onTrack,
  onClearOrders,
}: {
  orders: OrderRecord[];
  onReorder: (items: OrderLine[]) => void;
  onTrack: () => void;
  onClearOrders: () => void;
}) {
  const t = useT();
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <ShoppingBag className="h-4 w-4 text-brand" />
        <h3 className="font-display text-sm font-semibold">{t.account.ordersTitle}</h3>
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
            <OrderCard key={o.orderRef} order={o} onReorder={onReorder} onTrack={onTrack} />
          ))}
        </div>
      )}
    </section>
  );
}

function OrderCard({
  order,
  onReorder,
  onTrack,
}: {
  order: OrderRecord;
  onReorder: (items: OrderLine[]) => void;
  onTrack: () => void;
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
        <button
          onClick={onTrack}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-black/5"
        >
          <Truck className="h-3.5 w-3.5" /> {t.account.track}
        </button>
      </div>
    </div>
  );
}
