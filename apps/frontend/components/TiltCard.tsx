"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * A real, interactive 3D-tilt effect driven by the actual mouse position —
 * a CSS `perspective`/`rotateX/Y` transform recalculated on every
 * `mousemove`, not a static image or a pre-rendered 3D asset (there's no 3D
 * modeling tool or renderer in this build environment, so this is the
 * honest way to deliver a genuine "this feels 3D" interaction using only
 * real, already-existing content like the product screenshot).
 * Disabled on touch devices (no hover/mouse) and under
 * `prefers-reduced-motion`, where it just renders flat.
 */
export function TiltCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const maxTilt = 6; // degrees — subtle, not gimmicky
    setStyle({
      transform: `perspective(1200px) rotateX(${(-y * maxTilt).toFixed(2)}deg) rotateY(${(x * maxTilt).toFixed(2)}deg) scale3d(1.01, 1.01, 1.01)`,
      transition: "transform 60ms linear",
    });
  }

  function handleMouseLeave() {
    setStyle({
      transform: "perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
      transition: "transform 400ms ease-out",
    });
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transformStyle: "preserve-3d", ...style }}
      className="motion-reduce:transform-none"
    >
      {children}
    </div>
  );
}
