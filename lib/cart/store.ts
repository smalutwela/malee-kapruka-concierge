import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Money } from "@/lib/types";

export interface CartItem {
  id: string;
  name: string;
  price?: Money;
  image?: string | null;
  quantity: number;
  icingText?: string;
}

/** Keep only this many applied addIds for dedupe — plenty for a browser-local cart. */
const SEEN_ADDS_CAP = 200;

interface CartState {
  items: CartItem[];
  /**
   * Every addToCart-tool addId ever applied. useCaptureCartAdds re-scans the
   * whole transcript on every message change, so an already-applied add must be
   * recognisable forever — otherwise a restored transcript would re-add items
   * the shopper has since removed or checked out.
   */
  seenAdds: string[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  /** Apply an addToCart tool result exactly once, keyed by its unique addId. */
  applyAdd: (addId: string, item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  setIcing: (id: string, text: string) => void;
  clear: () => void;
}

/**
 * Client-side source of truth for the cart, persisted to localStorage so it
 * survives reloads (a "this replaces the website" experience never loses the
 * basket). `skipHydration` keeps the first client render identical to the SSR
 * HTML — ChatShell calls `useCart.persist.rehydrate()` after mount instead, so
 * there's no hydration mismatch.
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      seenAdds: [],
      add: (item, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.id === item.id);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.id === item.id ? { ...i, quantity: i.quantity + qty } : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, quantity: qty }] };
        }),
      applyAdd: (addId, item, qty = 1) => {
        if (get().seenAdds.includes(addId)) return;
        set((s) => ({ seenAdds: [addId, ...s.seenAdds].slice(0, SEEN_ADDS_CAP) }));
        get().add(item, qty);
      },
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      setQty: (id, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.id !== id)
              : s.items.map((i) => (i.id === id ? { ...i, quantity: qty } : i)),
        })),
      setIcing: (id, text) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, icingText: text } : i)) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "malee-cart",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ items: s.items, seenAdds: s.seenAdds }),
    },
  ),
);

export function cartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + (i.price?.amount ?? 0) * i.quantity, 0);
}
