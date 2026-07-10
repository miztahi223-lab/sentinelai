import { WorldMapBackground } from "@/components/WorldMapBackground";

/**
 * The shared ambient backdrop used across the entire site — a live,
 * continuously-animating global network map (dot-matrix continents with
 * pulsing data-connection arcs) plus a dot-grid texture and a soft glow.
 * Switched from the earlier matrix-code-rain treatment specifically
 * because a glowing world map reads as "professional, global-scale,
 * information-driven" rather than matrix-rain's more hacker-movie
 * register — the explicit ask this pass was built for. Extracted into one
 * component so every page gets the identical treatment instead of a
 * one-off copy of the markup; purely a background layer (`aria-hidden`,
 * `pointer-events-none`), scoped to whatever wraps it via `relative
 * overflow-hidden` (never `inset-0` on the whole page), so it never
 * interferes with real content or extends into sections that shouldn't
 * have it (see the landing page's own comment about not letting this
 * bleed behind the real product screenshot).
 */
export function AmbientBackground({
  glowClassName = "bg-indigo-600/20",
}: {
  glowClassName?: string;
}) {
  return (
    <>
      <WorldMapBackground className="opacity-[0.55]" />
      <div
        aria-hidden
        className="bg-hero-grid pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute start-1/2 top-[-10rem] h-[28rem] w-[52rem] -translate-x-1/2 rounded-full blur-3xl rtl:translate-x-1/2 ${glowClassName}`}
      />
    </>
  );
}
