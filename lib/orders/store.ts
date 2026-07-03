import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Money } from "@/lib/types";

/**
 * A local record of every order placed through Malee. The Kapruka MCP has no
 * "list my orders" tool (it's deliberately minimal), so order history lives
 * client-side. This powers the single most under-rated commerce lever Kapruka
 * called out — effortless **reordering** — and the "you never go back to the
 * website" experience: your past orders are right here.
 *
 * Captured the moment createOrder succeeds (see useCaptureOrders). Stored only
 * in the browser, like the cart and profile.
 */
export interface OrderLine {
  id: string;
  name: string;
  quantity: number;
  price?: Money;
  image?: string | null;
  icingText?: string;
}

export interface OrderRecord {
  orderRef: string;
  checkoutUrl: string;
  expiresAt?: string;
  createdAt: number;
  items: OrderLine[];
  total: number;
  currency: string;
  recipientName?: string;
  city?: string;
  deliveryDate?: string;
}

/** Keep only this many captured orderRefs for dedupe — plenty for a browser-local history. */
const SEEN_CAP = 300;

interface OrdersState {
  orders: OrderRecord[];
  /**
   * Every orderRef ever captured — kept through remove()/clear(). The capture
   * effect re-scans the whole transcript on every message change, so a ref
   * missing from `orders` must not read as "new order": it would resurrect
   * orders the shopper deleted (and re-run capture side effects on the cart
   * and profile).
   */
  seen: string[];
  /** Add an order, de-duped by orderRef (the capture effect may re-run on re-render). */
  add: (order: OrderRecord) => void;
  remove: (orderRef: string) => void;
  clear: () => void;
  /** True if this orderRef was ever captured, even if since removed/cleared. */
  hasSeen: (orderRef: string) => boolean;
}

export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      seen: [],
      add: (order) => {
        if (get().hasSeen(order.orderRef)) return;
        set((s) => ({
          orders: [order, ...s.orders],
          seen: [order.orderRef, ...s.seen].slice(0, SEEN_CAP),
        }));
      },
      remove: (orderRef) =>
        set((s) => ({ orders: s.orders.filter((o) => o.orderRef !== orderRef) })),
      clear: () => set({ orders: [] }),
      // The `orders` fallback covers state persisted before `seen` existed.
      hasSeen: (orderRef) =>
        get().seen.includes(orderRef) || get().orders.some((o) => o.orderRef === orderRef),
    }),
    {
      name: "malee-orders",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ orders: s.orders, seen: s.seen }),
    },
  ),
);
