"use client";

import { useTranslations } from "next-intl";

/**
 * A continuously scrolling heartbeat/EKG waveform — a real visual metaphor
 * for the actual "24/7 continuous re-scanning" feature (already a real
 * stat shown elsewhere on this page), not just decoration for its own
 * sake: your attack surface is being watched continuously, the same way a
 * heart monitor never stops. Pure SVG + CSS animation, no video/image
 * asset (there's no real footage to use honestly here, so — same
 * reasoning as `MatrixRain` — this is generated, not faked).
 */
const BEAT_PATH =
  "M0,20 L40,20 L48,20 L54,4 L62,36 L68,20 L76,20 L84,12 L90,28 L96,20 L200,20";

export function PulseMonitor({ className = "" }: { className?: string }) {
  const t = useTranslations("landing");

  return (
    <div
      className={`overflow-hidden rounded-xl border border-emerald-900/50 bg-black/60 px-5 py-4 ${className}`}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {t("pulseMonitorLabel")}
      </div>
      {/* Forced `dir="ltr"` — this is a generated waveform, not text, but
          the *scrolling direction* of the animation is authored assuming
          LTR overflow anchoring; without this, an RTL page context flips
          which edge the `w-[300%]` svg overflows from, cutting off almost
          the entire waveform (same reasoning as the forced-LTR URL bar in
          BrowserFrame.tsx). */}
      <div
        dir="ltr"
        className="h-12 w-full overflow-hidden motion-reduce:[&_.animate-pulse-scroll]:animate-none"
      >
        <svg
          viewBox="0 0 200 40"
          preserveAspectRatio="none"
          className="h-full w-[300%] animate-pulse-scroll"
          aria-hidden
        >
          {[0, 200, 400].map((offset) => (
            <path
              key={offset}
              d={BEAT_PATH}
              transform={`translate(${offset}, 0)`}
              fill="none"
              stroke="rgb(52 211 153 / 0.9)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
