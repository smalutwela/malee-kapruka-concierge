"use client";

import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";

const THEMES = [
  { id: "light", label: "Light", swatch: "#402970" },
  { id: "dark", label: "Dark", swatch: "#211a31" },
  { id: "warm", label: "Warm", swatch: "#0f7a5f" },
];

export function ThemeSwitcher() {
  const [theme, setTheme] = useState("light");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const current =
      document.documentElement.dataset.theme ||
      localStorage.getItem("malee-theme") ||
      "light";
    setTheme(current);
  }, []);

  function choose(id: string) {
    setTheme(id);
    setOpen(false);
    document.documentElement.dataset.theme = id;
    try {
      localStorage.setItem("malee-theme", id);
    } catch {
      /* ignore storage errors */
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Change theme"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:border-brand"
      >
        <Palette className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-card p-1 shadow-lg">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => choose(t.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink transition hover:bg-brand/10"
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-line"
                  style={{ background: t.swatch }}
                />
                <span className="flex-1">{t.label}</span>
                {theme === t.id && <Check className="h-4 w-4 text-brand" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
