import { create } from "zustand";
import type { Money } from "@/lib/types";

export interface CartItem {
  id: string;
  name: string;
  price?: Money;
  image?: string | null;
  quantity: number;
  icingText?: string;
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  setIcing: (id: string, text: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>((set) => ({
  items: [],
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
}));

export function cartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + (i.price?.amount ?? 0) * i.quantity, 0);
}
