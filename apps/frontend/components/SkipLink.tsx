"use client";

import { useTranslations } from "next-intl";

/**
 * "Skip to main content" — the first focusable element on every page,
 * required so keyboard/screen-reader users don't have to tab through the
 * entire nav/sidebar before reaching the actual page content (WCAG 2.4.1,
 * Bypass Blocks). Invisible until it receives keyboard focus (`sr-only` /
 * `focus:not-sr-only`) — sighted mouse users never see it, but it's the
 * very first Tab stop for anyone navigating by keyboard. Every route's
 * `<main>` element carries `id="main-content"` as the jump target.
 */
export function SkipLink() {
  const t = useTranslations("accessibility");

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-indigo-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
    >
      {t("skipToContent")}
    </a>
  );
}
