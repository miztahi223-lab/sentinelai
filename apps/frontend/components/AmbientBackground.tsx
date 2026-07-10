import { MatrixRain } from "@/components/MatrixRain";

/**
 * The same matrix-rain + dot-grid + glow backdrop used on the landing
 * page's hero, extracted into a reusable wrapper so every other page gets
 * the identical visual language instead of a one-off copy of the markup.
 * Purely a background layer — `aria-hidden`, `pointer-events-none`, and
 * scoped to whatever wraps it via `relative overflow-hidden` (never
 * `inset-0` on the whole page), so it never interferes with real content
 * or extends into sections that shouldn't have it (see the landing page's
 * own comment about not letting this bleed behind the real product
 * screenshot).
 */
export function AmbientBackground({
  glowClassName = "bg-indigo-600/20",
}: {
  glowClassName?: string;
}) {
  return (
    <>
      <MatrixRain className="opacity-[0.12]" />
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
