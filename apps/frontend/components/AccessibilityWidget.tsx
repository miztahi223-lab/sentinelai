"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Accessibility, Minus, Plus, RotateCcw, X } from "lucide-react";

type FontSize = "normal" | "large" | "xlarge";

interface A11yPrefs {
  fontSize: FontSize;
  highContrast: boolean;
  grayscale: boolean;
  underlineLinks: boolean;
  readableFont: boolean;
  reduceMotion: boolean;
}

const DEFAULT_PREFS: A11yPrefs = {
  fontSize: "normal",
  highContrast: false,
  grayscale: false,
  underlineLinks: false,
  readableFont: false,
  reduceMotion: false,
};

const STORAGE_KEY = "domecortex-a11y";

// Applies (or removes) every real, functioning CSS hook this widget
// controls — the single place that maps a preference object onto
// `<html>` classes, called both on initial load and on every toggle, so
// the DOM and the stored preference can never drift apart.
function applyPrefs(prefs: A11yPrefs) {
  const root = document.documentElement;
  root.classList.toggle("a11y-font-lg", prefs.fontSize === "large");
  root.classList.toggle("a11y-font-xl", prefs.fontSize === "xlarge");
  root.classList.toggle("a11y-contrast", prefs.highContrast);
  root.classList.toggle("a11y-grayscale", prefs.grayscale);
  root.classList.toggle("a11y-underline-links", prefs.underlineLinks);
  root.classList.toggle("a11y-readable-font", prefs.readableFont);
  root.classList.toggle("a11y-reduce-motion", prefs.reduceMotion);
}

// A minimal external store (module scope, outside React) backing
// `useSyncExternalStore` below — the SSR-safe, hydration-safe way to
// expose a client-only source (localStorage) as component state without a
// mount `useEffect` calling `setState` (which this codebase's ESLint
// config already flags — see the equivalent, deliberate fix documented in
// `organization-context.tsx`). `getSnapshot` is only ever invoked
// client-side by React, so the `localStorage` read inside it is safe;
// `getServerSnapshot` covers the actual SSR render.
let cachedPrefs: A11yPrefs | null = null;
let listeners: Array<() => void> = [];

function getSnapshot(): A11yPrefs {
  if (cachedPrefs === null) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      cachedPrefs = raw
        ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<A11yPrefs>) }
        : DEFAULT_PREFS;
    } catch {
      cachedPrefs = DEFAULT_PREFS;
    }
    applyPrefs(cachedPrefs);
  }
  return cachedPrefs;
}

function getServerSnapshot(): A11yPrefs {
  return DEFAULT_PREFS;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.push(onStoreChange);
  return () => {
    listeners = listeners.filter((l) => l !== onStoreChange);
  };
}

function setPrefs(next: A11yPrefs) {
  cachedPrefs = next;
  applyPrefs(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private-browsing/storage-disabled: the toggle still works for this
    // page view via the DOM classes above, it just won't persist.
  }
  listeners.forEach((l) => l());
}

/**
 * A real, functioning accessibility toolbar — not a decorative badge. Every
 * control here changes actual rendered CSS (font size, contrast, motion,
 * etc.) via classes on `<html>` defined in `globals.css`, and the choice
 * persists across visits via localStorage. This is in addition to (not a
 * replacement for) the underlying WCAG work already built into every page
 * (semantic HTML, keyboard nav, labeled forms, contrast ratios) — see the
 * accessibility statement page for what's structurally built in versus
 * what this widget lets a visitor further customize for themselves.
 */
export function AccessibilityWidget() {
  const t = useTranslations("accessibility");
  const [open, setOpen] = useState(false);
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // `getServerSnapshot` (always `DEFAULT_PREFS`) is what both the server
  // render and the client's *first* hydration pass use — React then
  // immediately re-renders with the real `getSnapshot()` value right after
  // hydrating, without a mismatch warning, which is exactly what
  // `useSyncExternalStore` exists for. The panel/button JSX below is
  // identical either way except for the specific preference values, so
  // there's no separate "hydrated" gate needed the way a plain
  // `useState`-based version would require.
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const update = useCallback(
    (next: Partial<A11yPrefs>) => setPrefs({ ...getSnapshot(), ...next }),
    [],
  );

  const reset = useCallback(() => setPrefs(DEFAULT_PREFS), []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const cycleFontSize = (direction: 1 | -1) => {
    const order: FontSize[] = ["normal", "large", "xlarge"];
    const idx = order.indexOf(prefs.fontSize);
    const next = order[Math.min(Math.max(idx + direction, 0), order.length - 1)];
    update({ fontSize: next });
  };

  const toggles: {
    key: keyof A11yPrefs;
    label: string;
  }[] = [
    { key: "highContrast", label: t("highContrast") },
    { key: "grayscale", label: t("grayscale") },
    { key: "underlineLinks", label: t("underlineLinks") },
    { key: "readableFont", label: t("readableFont") },
    { key: "reduceMotion", label: t("reduceMotion") },
  ];

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="a11y-widget-title"
          tabIndex={-1}
          className="absolute bottom-16 left-0 w-72 rounded-xl border border-gray-800 bg-gray-900 p-4 shadow-2xl outline-none"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 id="a11y-widget-title" className="text-sm font-semibold text-white">
              {t("widgetTitle")}
            </h2>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label={t("close")}
              className="rounded-md p-1 text-gray-400 transition hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="mb-3">
            <span className="mb-1 block text-xs font-medium text-gray-300">
              {t("fontSize")}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cycleFontSize(-1)}
                disabled={prefs.fontSize === "normal"}
                aria-label={t("decreaseFontSize")}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 text-gray-200 transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <span className="min-w-16 text-center text-xs text-gray-400">
                {t(`fontSize_${prefs.fontSize}`)}
              </span>
              <button
                type="button"
                onClick={() => cycleFontSize(1)}
                disabled={prefs.fontSize === "xlarge"}
                aria-label={t("increaseFontSize")}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 text-gray-200 transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {toggles.map(({ key, label }) => {
              const active = Boolean(prefs[key]);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ [key]: !active } as Partial<A11yPrefs>)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-2 text-start text-sm text-gray-200 transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <span>{label}</span>
                  <span
                    aria-hidden="true"
                    className={`h-4 w-8 rounded-full border transition ${
                      active ? "border-indigo-400 bg-indigo-500" : "border-gray-600 bg-gray-700"
                    }`}
                  >
                    <span
                      className={`block h-3.5 w-3.5 translate-y-[1px] rounded-full bg-white transition-transform ${
                        active ? "translate-x-[17px]" : "translate-x-[1px]"
                      }`}
                    />
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={reset}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-gray-700 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <RotateCcw size={14} aria-hidden="true" />
            {t("resetAll")}
          </button>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("widgetLabel")}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-gray-950"
      >
        <Accessibility size={28} aria-hidden="true" />
      </button>
    </div>
  );
}
