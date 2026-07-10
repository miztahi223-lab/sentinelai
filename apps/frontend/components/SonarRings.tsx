/**
 * Slow-expanding, fading concentric rings radiating from a center point —
 * a lightweight CSS-only depth/"tunnel" accent. There's no 3D
 * modeling/rendering tool in this build environment, so a literal 3D
 * tunnel scene isn't something that can be built honestly (it would need
 * real 3D assets or a WebGL scene built well enough not to look worse than
 * not having one) — concentric rings pulsing outward reads as "actively
 * scanning, radiating outward" and is achievable with plain CSS.
 * Purely decorative (`aria-hidden`); respects `prefers-reduced-motion` via
 * the `motion-reduce:` utility variants, same as the rest of this page's
 * new animated accents.
 */
export function SonarRings({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-ring-expand motion-reduce:animate-none absolute h-24 w-24 rounded-full border border-emerald-400/40"
          style={{ animationDelay: `${i * 1.2}s` }}
        />
      ))}
    </div>
  );
}
