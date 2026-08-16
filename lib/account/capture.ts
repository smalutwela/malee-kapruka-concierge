"use client";

import { useEffect } from "react";
import type { UIMessage } from "ai";
import { useAccount } from "@/lib/account/store";
import { useProfile, type BuyerDetails } from "@/lib/profile/store";
import type { CustomerProfile, SavedAddress } from "@/lib/types";

type ToolPart = {
  type: string;
  state?: string;
  output?: unknown;
};

/**
 * Bridge account lookups back into local state, so the value of signing in
 * survives the conversation that produced it:
 *
 *  - the customer's name is cached (greet a returning visitor instantly, with
 *    no tool call), and
 *  - their Kapruka name/phone/address seed the saved checkout details, but only
 *    if those are still empty — a shopper's own edits always win.
 *
 * Seeding prefers the address book's "Home" entry over the billing address,
 * which the test data shows is often unset ("NA"). Like the cart/order capture
 * effects, `enabled` must only flip true once the stores have rehydrated,
 * otherwise a restored transcript would seed over freshly-loaded edits.
 */
export function useCaptureAccount(messages: UIMessage[], enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let profile: CustomerProfile | null = null;
    let home: SavedAddress | null = null;

    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const part of m.parts as ToolPart[]) {
        if (part.state !== "output-available") continue;

        if (part.type === "tool-getAccountProfile") {
          const customer = (part.output as { customer?: CustomerProfile } | undefined)?.customer;
          if (customer?.email) profile = customer;
        }

        if (part.type === "tool-getSavedAddresses") {
          const list = (part.output as { addresses?: SavedAddress[] } | undefined)?.addresses;
          if (list?.length) home = list.find((a) => a.label === "Home") ?? list[0];
        }
      }
    }

    if (!profile) return;

    const account = useAccount.getState();
    // Only trust a lookup for the account the shopper is actually signed into.
    if (account.email && profile.email.toLowerCase() !== account.email) return;
    if (profile.fullName) account.setName(profile.fullName);

    const incoming: BuyerDetails = {
      name: profile.fullName ?? home?.name ?? "",
      phone: profile.phone ?? home?.phone ?? "",
      address: home?.address ?? profile.billing?.address ?? "",
      city: home?.city ?? profile.billing?.city ?? "",
    };

    const store = useProfile.getState();
    const current = store.details;
    if (!current) {
      store.seed(incoming);
      return;
    }

    // The profile lookup usually lands a turn before the address lookup, so a
    // plain seed() would lock in a record with a name and phone but no address
    // and never complete it. Fill only the blanks — a value the shopper has
    // already typed (or edited) is never overwritten.
    const merged: BuyerDetails = {
      name: current.name.trim() || incoming.name,
      phone: current.phone.trim() || incoming.phone,
      address: current.address.trim() || incoming.address,
      city: current.city.trim() || incoming.city,
    };
    const changed = (Object.keys(merged) as (keyof BuyerDetails)[]).some(
      (k) => merged[k] !== current[k],
    );
    if (changed) store.set(merged);
  }, [messages, enabled]);
}
