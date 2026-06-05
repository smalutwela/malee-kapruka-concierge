"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./config";
import { getMessages, type Messages } from "./messages";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: Messages;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Persist the choice in a year-long cookie so the server renders the right language on the next load. */
function persistLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore cookie write errors (e.g. disabled cookies) */
  }
}

/**
 * Seeded with the server-resolved `initialLocale` (read from the cookie in the
 * root layout), so the first client render matches the SSR HTML — no flash, no
 * hydration mismatch. Switching updates React state for a live re-render and
 * writes the cookie for subsequent loads.
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: getMessages(locale) }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Fail soft outside a provider (e.g. an isolated test render): English default.
    return { locale: DEFAULT_LOCALE, setLocale: () => {}, t: getMessages(DEFAULT_LOCALE) };
  }
  return ctx;
}

/** Current locale + a setter for the switcher. */
export function useLocale(): { locale: Locale; setLocale: (next: Locale) => void } {
  const { locale, setLocale } = useLocaleContext();
  return { locale, setLocale };
}

/** The translated message bundle for the current locale. */
export function useT(): Messages {
  return useLocaleContext().t;
}
