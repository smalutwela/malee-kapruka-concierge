"use client";

import { useEffect } from "react";
import type { UIMessage } from "ai";
import { useCart } from "@/lib/cart/store";
import { useProfile } from "@/lib/profile/store";
import { useOrders, type OrderLine } from "@/lib/orders/store";
import type { OrderConfirmation } from "@/lib/types";

/** Shape of the createOrder tool input the model sends (see lib/agent/tools.ts). */
interface CreateOrderInput {
  cart?: { productId: string; quantity?: number; icingText?: string }[];
  recipient?: { name?: string; phone?: string };
  delivery?: { address?: string; city?: string; date?: string };
  sender?: { name?: string };
}

type ToolPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
};

/**
 * Watch the chat transcript and, whenever a createOrder tool call comes back
 * with a pay link, record it to local order history and seed the saved profile.
 *
 * The order's line items are taken from the tool *input* (the authoritative list
 * of what was actually ordered) and enriched with name/price/image from the live
 * cart by product id, so the history card and Reorder both have rich data even
 * if the cart is later edited. De-duped by order_ref in the store, so this is
 * safe to re-run on every render.
 */
export function useCaptureOrders(messages: UIMessage[]): void {
  useEffect(() => {
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const part of m.parts as ToolPart[]) {
        if (part.type !== "tool-createOrder" || part.state !== "output-available") continue;
        const out = part.output as OrderConfirmation | undefined;
        if (!out?.checkout_url || !out.order_ref) continue;

        const input = (part.input ?? {}) as CreateOrderInput;
        const cartItems = useCart.getState().items;
        const lines: OrderLine[] = (input.cart ?? []).map((line) => {
          const known = cartItems.find((c) => c.id === line.productId);
          return {
            id: line.productId,
            name: known?.name ?? line.productId,
            quantity: line.quantity ?? 1,
            price: known?.price,
            image: known?.image,
            icingText: line.icingText,
          };
        });

        useOrders.getState().add({
          orderRef: out.order_ref,
          checkoutUrl: out.checkout_url,
          expiresAt: out.expires_at,
          createdAt: Date.now(),
          items: lines,
          total: out.summary?.grand_total ?? 0,
          currency: out.summary?.currency ?? "LKR",
          recipientName: input.recipient?.name,
          city: input.delivery?.city,
          deliveryDate: input.delivery?.date,
        });

        useProfile.getState().seed({
          name: input.recipient?.name ?? input.sender?.name ?? "",
          phone: input.recipient?.phone ?? "",
          address: input.delivery?.address ?? "",
          city: input.delivery?.city ?? "",
        });
      }
    }
  }, [messages]);
}
