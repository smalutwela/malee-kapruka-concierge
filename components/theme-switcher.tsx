"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Palette } from "lucide-react";
import { useT } from "@/lib/i18n/context";

const THEMES = [
  { id: "dark", swatch: "#211a31" },
  { id: "light", swatch: "#402970" },
  { id: "warm", swatch: "#0f7a5f" },
] as const;

const STORAGE_KEY = "malee-theme";
const DEFAULT_THEME = "dark";

/**
 * The active theme is *external* state: it lives on `<html data-theme>` (applied
 * pre-paint by the inline script in app/layout.tsx) and in localStorage. We read
 * it with useSyncExternalStore — React's sanctioned hook for a mutable external
 * store — and write it from a module-scope helper, so the DOM mutation isn't
 * analysed as component-render code. Theme is client-only (no cookie), so the
 * server snapshot is just the default.
 */
const listeners = new Set<() => void>();

function getThemeSnapshot(): string {
  return (
    document.documentElement.dataset.theme || localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME
  );
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function applyTheme(id: string) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore storage errors */
  }
  listeners.forEach((notify) => notify());
}

export function ThemeSwitcher() {
  const t = useT();
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, () => DEFAULT_THEME);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t.controls.changeTheme}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:border-brand"
      >
        <Palette className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-card p-1 shadow-lg">
            {THEMES.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  applyTheme(option.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink transition hover:bg-brand/10"
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-line"
                  style={{ background: option.swatch }}
                />
                <span className="flex-1">{t.themes[option.id]}</span>
                {theme === option.id && <Check className="h-4 w-4 text-brand" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
