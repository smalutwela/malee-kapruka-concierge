"use client";

import { cn } from "@/lib/utils";

/**
 * The shell shared by the cart and account panels: a **bottom sheet** on phones
 * — thumb-reachable, and the shape a mobile shopper expects — and the same
 * right-hand side panel as before from `sm` up.
 *
 * One element, two behaviours, so the transform axis changes at the breakpoint:
 * both axes are pinned explicitly in each state, otherwise a closed sheet keeps
 * a stale translate from the other axis and parks itself off-screen diagonally.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("fixed inset-0 z-30", open ? "pointer-events-auto" : "pointer-events-none")}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        aria-label={label}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl bg-cream shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0 translate-y-0" : "translate-x-0 translate-y-full",
          "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-sm sm:rounded-none",
          open ? "sm:translate-x-0 sm:translate-y-0" : "sm:translate-x-full sm:translate-y-0",
        )}
      >
        {/* Grab handle — the affordance that says "this pulls down". Phones only. */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        {children}
      </aside>
    </div>
  );
}
