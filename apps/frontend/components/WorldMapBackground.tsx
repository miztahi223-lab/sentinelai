"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * A real, animated "global network" background — a dot-matrix world map
 * with glowing connection arcs pulsing between points, continuously and
 * proceduraly generated on canvas (no map image/tile service, no fake
 * "live global threat data" claim — this is a stylistic ambient
 * background, the same honest category as MatrixRain/Tunnel/NetworkGlobe,
 * not a real telemetry dashboard). Chosen for this pass specifically
 * because a glowing world map is the established visual language serious
 * B2B security products use to read as "professional, global-scale,
 * trustworthy" — as opposed to MatrixRain's more hacker-movie register.
 *
 * The continent silhouettes are a coarse, hand-authored point cloud (an
 * equirectangular approximation), not a precise geographic dataset —
 * intentionally stylized/low-fidelity rather than pretending to be a real
 * mapping product.
 */

// Coarse continent silhouettes as normalized [x, y] (0-1) point clusters in
// equirectangular space. Deliberately approximate — legible at a glance as
// "world map," not a geographic reference.
const CONTINENTS: [number, number][][] = [
  // North America
  [
    [0.08, 0.22], [0.1, 0.2], [0.13, 0.19], [0.16, 0.18], [0.19, 0.19],
    [0.12, 0.24], [0.15, 0.23], [0.18, 0.24], [0.21, 0.25], [0.1, 0.28],
    [0.13, 0.29], [0.16, 0.3], [0.19, 0.31], [0.22, 0.29], [0.12, 0.33],
    [0.15, 0.35], [0.18, 0.36], [0.14, 0.39], [0.17, 0.4], [0.2, 0.38],
    [0.09, 0.31], [0.22, 0.21], [0.24, 0.24],
  ],
  // South America
  [
    [0.24, 0.48], [0.26, 0.46], [0.28, 0.47], [0.25, 0.51], [0.27, 0.53],
    [0.29, 0.55], [0.26, 0.58], [0.24, 0.6], [0.27, 0.62], [0.25, 0.65],
    [0.23, 0.67], [0.26, 0.69], [0.22, 0.44], [0.29, 0.5],
  ],
  // Europe
  [
    [0.46, 0.18], [0.48, 0.17], [0.5, 0.18], [0.47, 0.2], [0.49, 0.21],
    [0.51, 0.19], [0.53, 0.2], [0.45, 0.22], [0.48, 0.23], [0.51, 0.22],
    [0.44, 0.19],
  ],
  // Africa
  [
    [0.47, 0.28], [0.49, 0.27], [0.51, 0.28], [0.53, 0.3], [0.48, 0.32],
    [0.5, 0.34], [0.52, 0.36], [0.49, 0.38], [0.47, 0.4], [0.5, 0.42],
    [0.48, 0.44], [0.46, 0.46], [0.51, 0.44], [0.45, 0.3], [0.53, 0.24],
    [0.55, 0.27],
  ],
  // Asia
  [
    [0.56, 0.16], [0.6, 0.15], [0.64, 0.16], [0.68, 0.15], [0.72, 0.17],
    [0.58, 0.19], [0.62, 0.2], [0.66, 0.19], [0.7, 0.2], [0.74, 0.19],
    [0.6, 0.23], [0.64, 0.24], [0.68, 0.23], [0.72, 0.24], [0.76, 0.22],
    [0.63, 0.27], [0.67, 0.28], [0.71, 0.27], [0.75, 0.26], [0.66, 0.31],
    [0.7, 0.32], [0.74, 0.3], [0.78, 0.28], [0.56, 0.2], [0.8, 0.24],
  ],
  // Australia
  [
    [0.78, 0.52], [0.81, 0.51], [0.84, 0.52], [0.8, 0.55], [0.83, 0.55],
    [0.86, 0.53], [0.79, 0.57],
  ],
];

interface Point {
  x: number;
  y: number;
}

interface Arc {
  from: Point;
  to: Point;
  progress: number; // 0-1, draw-in
  holdUntil: number;
  fadeProgress: number; // 0-1, fade-out
  phase: "drawing" | "holding" | "fading" | "done";
}

export function WorldMapBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const allPoints = useMemo(
    () => CONTINENTS.flat().map(([x, y]) => ({ x, y })),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;

    function resize() {
      const el = canvasRef.current;
      if (!el || !ctx) return;
      const rect = el.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      el.width = width * dpr;
      el.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function toScreen(p: Point) {
      return { x: p.x * width, y: p.y * height };
    }

    // A handful of concurrent traveling arcs between random dots, each
    // independently drawing in, holding briefly lit, then fading — new
    // ones keep spawning so there's always a few in flight.
    const arcs: Arc[] = [];
    const MAX_ARCS = 7;

    function spawnArc() {
      const from = allPoints[Math.floor(Math.random() * allPoints.length)];
      let to = allPoints[Math.floor(Math.random() * allPoints.length)];
      let guard = 0;
      while (to === from && guard < 5) {
        to = allPoints[Math.floor(Math.random() * allPoints.length)];
        guard++;
      }
      arcs.push({
        from,
        to,
        progress: 0,
        holdUntil: 0,
        fadeProgress: 0,
        phase: "drawing",
      });
    }

    if (!prefersReducedMotion) {
      for (let i = 0; i < 3; i++) spawnArc();
    }

    let animationFrame: number;
    let lastTime = performance.now();

    function arcPoint(from: Point, to: Point, t: number) {
      const a = toScreen(from);
      const b = toScreen(to);
      // A gentle upward bow for a "great circle" flight-path feel.
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.15;
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * midX + t * t * b.x;
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * midY + t * t * b.y;
      return { x, y };
    }

    function draw(now: number) {
      animationFrame = requestAnimationFrame(draw);
      if (!ctx) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // Static dot-matrix continents.
      ctx.fillStyle = "rgba(99, 179, 237, 0.35)";
      for (const p of allPoints) {
        const s = toScreen(p);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        for (const arc of arcs) {
          if (arc.phase === "drawing") {
            arc.progress = Math.min(1, arc.progress + dt * 0.6);
            if (arc.progress >= 1) {
              arc.phase = "holding";
              arc.holdUntil = now + 500;
            }
          } else if (arc.phase === "holding") {
            if (now >= arc.holdUntil) arc.phase = "fading";
          } else if (arc.phase === "fading") {
            arc.fadeProgress = Math.min(1, arc.fadeProgress + dt * 0.8);
            if (arc.fadeProgress >= 1) arc.phase = "done";
          }

          const segments = 40;
          const drawTo = arc.phase === "drawing" ? arc.progress : 1;
          const opacity = 0.55 * (1 - arc.fadeProgress);

          ctx.strokeStyle = `rgba(52, 211, 153, ${opacity})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let i = 0; i <= segments * drawTo; i++) {
            const t = i / segments;
            const pt = arcPoint(arc.from, arc.to, t);
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();

          // Leading pulse dot while drawing.
          if (arc.phase === "drawing") {
            const head = arcPoint(arc.from, arc.to, drawTo);
            ctx.beginPath();
            ctx.arc(head.x, head.y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(163, 230, 216, ${Math.min(1, opacity + 0.3)})`;
            ctx.fill();
          }

          // Endpoint glow markers.
          for (const endpoint of [arc.from, arc.to]) {
            const s = toScreen(endpoint);
            ctx.beginPath();
            ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(52, 211, 153, ${opacity * 0.6})`;
            ctx.fill();
          }
        }

        // Remove finished arcs and top back up to MAX_ARCS.
        for (let i = arcs.length - 1; i >= 0; i--) {
          if (arcs[i].phase === "done") arcs.splice(i, 1);
        }
        while (arcs.length < MAX_ARCS && Math.random() < 0.05) {
          spawnArc();
        }
      }
    }

    animationFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, [allPoints]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
