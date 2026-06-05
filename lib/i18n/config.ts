/**
 * Locale configuration for Malee's UI.
 *
 * English is the default; Sinhala (සිංහල) and Tamil (தமிழ்) are the two other
 * official languages of Sri Lanka. We deliberately do NOT use Next.js sub-path
 * routing (`/si`, `/ta`) — Malee is a single-screen client app, so the locale is
 * a cookie-backed preference read in the root layout (SSR-correct) and switched
 * live on the client. See lib/i18n/context.tsx.
 */

export const LOCALES = ["en", "si", "ta"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that carries the chosen locale so the server can render the right language. */
export const LOCALE_COOKIE = "malee-locale";

/** Display metadata for the switcher — `native` is the language's own name. */
export const LOCALE_META: Record<Locale, { label: string; native: string }> = {
  en: { label: "English", native: "English" },
  si: { label: "Sinhala", native: "සිංහල" },
  ta: { label: "Tamil", native: "தமிழ்" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Coerce any input (cookie value, etc.) to a supported locale, defaulting to English. */
export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
