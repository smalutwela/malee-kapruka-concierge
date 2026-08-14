import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Who the shopper is on Kapruka — the key that unlocks the Phase 2 account
 * tools (profile, order history, saved addresses).
 *
 * Only the email is authoritative, and it is only ever set from something the
 * shopper typed themselves: the sign-in field in the account drawer, or their
 * own words in the chat. `name` is a convenience cached after the first profile
 * lookup so a returning visit can greet them without spending a tool call.
 *
 * Stored in the browser like the cart and profile — there is no session, no
 * password, and nothing server-side. Signing out is a local erase. The email
 * rides with each chat request purely so the server can authorise the lookup;
 * see the allowlist in app/api/chat/route.ts.
 */
interface AccountState {
  email: string | null;
  name: string | null;
  /** Sign in with an email the shopper typed. Clears any stale cached name. */
  signIn: (email: string) => void;
  /** Cache the display name once a profile lookup returns one. */
  setName: (name: string) => void;
  signOut: () => void;
}

export const useAccount = create<AccountState>()(
  persist(
    (set, get) => ({
      email: null,
      name: null,
      signIn: (email) => {
        const clean = email.trim().toLowerCase();
        if (!clean) return;
        // A different shopper means the cached name no longer applies.
        set({ email: clean, name: clean === get().email ? get().name : null });
      },
      setName: (name) => {
        const clean = name.trim();
        if (clean && clean !== get().name) set({ name: clean });
      },
      signOut: () => set({ email: null, name: null }),
    }),
    {
      name: "malee-account",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ email: s.email, name: s.name }),
    },
  ),
);
