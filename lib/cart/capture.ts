"use client";

import { useEffect } from "react";
import type { UIMessage } from "ai";
import { useCart } from "@/lib/cart/store";
import type { AddToCartToolOutput } from "@/lib/types";

type ToolPart = {
  type: string;
  state?: string;
  output?: unknown;
};

/**
 * Watch the chat transcript and apply every addToCart tool result to the cart
 * store — the sibling of useCaptureOrders, for cart adds. The tool executes
 * server-side (authoritative name/price/image from the catalogue) and the cart
 * lives client-side, so this effect is the bridge.
 *
 * Each result carries a unique addId, applied exactly once via the store's
 * persisted `seenAdds` set — so a restored transcript (reload, resumed chat)
 * never re-adds items the shopper has since removed or checked out. Like order
 * capture, `enabled` must only flip true after the cart store has rehydrated.
 */
export function useCaptureCartAdds(messages: UIMessage[], enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const part of m.parts as ToolPart[]) {
        if (part.type !== "tool-addToCart" || part.state !== "output-available") continue;
        const out = part.output as AddToCartToolOutput | undefined;
        if (!out?.addId || !out.item?.id) continue;
        useCart.getState().applyAdd(
          out.addId,
          {
            id: out.item.id,
            name: out.item.name,
            price: out.item.price ?? undefined,
            image: out.item.image,
          },
          out.quantity ?? 1,
        );
      }
    }
  }, [messages, enabled]);
}
