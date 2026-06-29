"use client";

import { useEffect } from "react";
import type { UIMessage } from "ai";
import { useCart } from "@/lib/cart/store";
import { useProfile } from "@/lib/profile/store";
import { useOrders, type OrderLine } from "@/lib/orders/store";
import type { CreateOrderToolInput, OrderConfirmation } from "@/lib/types";

type ToolPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
};

/**
 * Watch the chat transcript and, whenever a createOrder tool call comes back
 * with a pay link, record it to local order history, seed the saved profile,
 * and clear the cart (the order is placed — a full cart would just confuse the
 * next turn).
 *
 * The order's line items are taken from the tool *input* (the authoritative list
 * of what was actually ordered) and enriched with name/price/image from the live
 * cart by product id; for a direct order (empty cart) the model-provided line
 * `name` is the fallback. De-duped by order_ref BEFORE any side effects, so
 * re-running over a restored transcript never re-clears the cart — which is why
 * `enabled` must only flip true after the orders store has rehydrated.
 */
export function useCaptureOrders(messages: UIMessage[], enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const part of m.parts as ToolPart[]) {
        if (part.type !== "tool-createOrder" || part.state !== "output-available") continue;
        const out = part.output as OrderConfirmation | undefined;
        if (!out?.checkout_url || !out.order_ref) continue;
        if (useOrders.getState().orders.some((o) => o.orderRef === out.order_ref)) continue;

        const input = (part.input ?? {}) as CreateOrderToolInput;
        const cartItems = useCart.getState().items;
        const lines: OrderLine[] = (input.cart ?? []).map((line) => {
          const known = cartItems.find((c) => c.id === line.productId);
          return {
            id: line.productId,
            name: known?.name ?? line.name ?? line.productId,
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

        // The order is placed — empty the cart so the next turn starts clean.
        // (OrderSummaryCard reads its lines from the order record/tool input,
        // not the live cart, so clearing here never blanks the receipt.)
        if (cartItems.length) useCart.getState().clear();

        // Only seed the saved profile from a self-purchase — never from a gift to
        // someone else, or we'd store the recipient's details as the shopper's.
        const giftMessage = input.giftMessage?.trim();
        const senderName = input.sender?.name?.trim();
        const recipientName = input.recipient?.name?.trim();
        const looksLikeGift =
          Boolean(giftMessage) ||
          Boolean(input.sender?.anonymous) ||
          Boolean(
            senderName &&
              recipientName &&
              senderName.toLowerCase() !== recipientName.toLowerCase(),
          );
        if (!looksLikeGift) {
          useProfile.getState().seed({
            name: recipientName ?? senderName ?? "",
            phone: input.recipient?.phone ?? "",
            address: input.delivery?.address ?? "",
            city: input.delivery?.city ?? "",
          });
        }
      }
    }
  }, [messages, enabled]);
}
