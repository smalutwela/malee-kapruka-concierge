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

interface OrdersState {
  orders: OrderRecord[];
  /** Add an order, de-duped by orderRef (the capture effect may re-run on re-render). */
  add: (order: OrderRecord) => void;
  remove: (orderRef: string) => void;
  clear: () => void;
}

export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      add: (order) => {
        if (get().orders.some((o) => o.orderRef === order.orderRef)) return;
        set((s) => ({ orders: [order, ...s.orders] }));
      },
      remove: (orderRef) =>
        set((s) => ({ orders: s.orders.filter((o) => o.orderRef !== orderRef) })),
      clear: () => set({ orders: [] }),
    }),
    {
      name: "malee-orders",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ orders: s.orders }),
    },
  ),
);
