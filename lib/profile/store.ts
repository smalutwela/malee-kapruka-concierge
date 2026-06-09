import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The shopper's reusable contact + delivery details — the friction-killer for
 * repeat orders. Kapruka's own pain point is that a brand-new order takes ~7
 * minutes of form-filling; remembering these turns a repeat checkout into a
 * one-tap "same as last time?".
 *
 * Stored ONLY in the browser (localStorage) — never on a server, no account —
 * which keeps the privacy story clean (Kapruka's stated top concern). The
 * shopper can edit or clear it anytime from the account drawer.
 */
export interface BuyerDetails {
  name: string;
  phone: string;
  address: string;
  city: string;
}

interface ProfileState {
  details: BuyerDetails | null;
  /** Overwrite saved details (manual edit from the account drawer). */
  set: (details: BuyerDetails) => void;
  /** Seed details only if none exist yet — used to capture the first order without clobbering edits. */
  seed: (details: BuyerDetails) => void;
  clear: () => void;
}

const hasAny = (d: Partial<BuyerDetails>): boolean =>
  Boolean(d.name?.trim() || d.phone?.trim() || d.address?.trim() || d.city?.trim());

export const useProfile = create<ProfileState>()(
  persist(
    (set, get) => ({
      details: null,
      set: (details) => set({ details }),
      seed: (details) => {
        if (!get().details && hasAny(details)) set({ details });
      },
      clear: () => set({ details: null }),
    }),
    {
      name: "malee-profile",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ details: s.details }),
    },
  ),
);
