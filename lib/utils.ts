import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format an amount as a Sri Lankan rupee (or other currency) price string. */
export function formatPrice(amount: number | null | undefined, currency = "LKR"): string {
  if (amount === null || amount === undefined) return "Price on request";
  const formatted = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(amount);
  return currency === "LKR" ? `Rs ${formatted}` : `${currency} ${formatted}`;
}

/**
 * Kapruka product images come from a CDN that resizes via a `width=` segment
 * in the path. Bump it for hero/detail views; pass through anything else.
 */
export function resizeImage(url: string | null | undefined, width: number): string | null {
  if (!url) return null;
  return url.replace(/(\/product-image\/)width=\d+/, `$1width=${width}`);
}
