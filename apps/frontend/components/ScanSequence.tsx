"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * A looping, typed-out terminal animation illustrating the scan workflow —
 * an animated *sequence* of frames, built the same honest way as
 * `MatrixRain`: procedurally generated in the browser, not a real customer's
 * real data. It uses a generic placeholder domain and explicitly says so
 * (`previewCaption`, translated) rather than implying it's a live/real scan
 * — the real screenshot further down the page (`BrowserFrame`) is what
 * carries the actual "not a mockup" claim.
 */
const STEP_COUNT = 8;

export function ScanSequence() {
  const t = useTranslations("landing");
  // Computed once via a lazy initializer (not an effect + setState) so
  // there's nothing to "synchronize" here — this is the initial value
  // itself, read from the environment exactly once per mount. Guarded for
  // SSR (`window` doesn't exist server-side); the rare hydration mismatch
  // for users who do have the OS preference set corrects itself
  // immediately and only affects this purely decorative animation.
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;

    let cancelled = false;
    let stepIndex = 0;

    function scheduleNext(delay: number) {
      const id = window.setTimeout(() => {
        if (cancelled) return;
        stepIndex += 1;
        setVisibleSteps(stepIndex);
        if (stepIndex >= STEP_COUNT) {
          setDone(true);
          // Pause on the completed state, then loop.
          window.setTimeout(() => {
            if (cancelled) return;
            stepIndex = 0;
            setVisibleSteps(0);
            setDone(false);
            scheduleNext(600);
          }, 3200);
        } else {
          scheduleNext(500);
        }
      }, delay);
      return id;
    }

    const timeoutId = scheduleNext(600);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [reducedMotion]);

  const steps = [
    { text: `$ sentinelai scan yourbusiness.com`, tone: "command" },
    { text: t("scanStep1"), tone: "info" },
    { text: t("scanStep2"), tone: "info" },
    { text: t("scanStep3"), tone: "info" },
    { text: t("scanStep4"), tone: "critical" },
    { text: t("scanStep5"), tone: "info" },
    { text: t("scanStep6"), tone: "warn" },
    { text: t("scanStep7"), tone: "success" },
  ] as const;

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-900/50 bg-black/70 shadow-2xl shadow-emerald-950/30 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-emerald-900/40 bg-black/60 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
        </div>
        <span className="mx-auto font-mono text-xs text-emerald-500/70">
          sentinelai — scan.sh
        </span>
      </div>
      {/* Forced `dir="ltr"` — terminal/command output reads left-to-right
          regardless of UI language (same as a real shell would), same
          reasoning as the forced-LTR URL bar in BrowserFrame.tsx. The
          Hebrew translations rendered inside still display correctly;
          only the overall line direction and "> " prefix position are
          pinned to the LTR terminal convention. */}
      <div
        dir="ltr"
        className="min-h-[220px] p-5 text-start font-mono text-[13px] leading-relaxed sm:text-sm"
      >
        {steps.slice(0, reducedMotion ? STEP_COUNT : visibleSteps).map((step, i) => (
          <p
            key={i}
            className={
              step.tone === "command"
                ? "text-emerald-300"
                : step.tone === "critical"
                  ? "animate-pulse font-bold text-red-400"
                  : step.tone === "warn"
                    ? "text-amber-400"
                    : step.tone === "success"
                      ? "text-emerald-400 font-semibold"
                      : "text-emerald-500/80"
            }
          >
            {step.tone !== "command" && (
              <span
                className={
                  step.tone === "critical" ? "text-red-700" : "text-emerald-700"
                }
              >
                {"> "}
              </span>
            )}
            {step.text}
          </p>
        ))}
        {!reducedMotion && !done && visibleSteps > 0 && (
          <span className="inline-block h-3.5 w-2 animate-pulse bg-emerald-400 align-middle" />
        )}
      </div>
    </div>
  );
}
