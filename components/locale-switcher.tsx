"use client";

import { useState } from "react";
import { Check, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { LOCALES, LOCALE_META } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/context";

/** `align="up"` opens the menu above the button — for the sidebar footer, where there's no room below. */
export function LocaleSwitcher({ align = "down" }: { align?: "down" | "up" }) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t.controls.changeLanguage}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:border-brand sm:h-9 sm:w-9"
      >
        <Languages className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute z-30 w-44 overflow-hidden rounded-xl border border-line bg-card p-1 shadow-lg",
              align === "up" ? "bottom-full left-0 mb-2" : "right-0 mt-2",
            )}
          >
            {LOCALES.map((code) => (
              <button
                key={code}
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink transition hover:bg-brand/10"
              >
                <span className="flex-1">
                  {LOCALE_META[code].native}
                  {LOCALE_META[code].native !== LOCALE_META[code].label && (
                    <span className="ml-1.5 text-xs text-muted">{LOCALE_META[code].label}</span>
                  )}
                </span>
                {locale === code && <Check className="h-4 w-4 text-brand" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
