"use client";

import { useEffect, useRef } from "react";

/**
 * A real 3D tunnel flythrough, rendered on canvas with hand-written
 * perspective projection (same technique as NetworkGlobe.tsx, no Three.js
 * dependency added just for this). This is deliberately a much bigger,
 * more technically involved set-piece than a static decorative accent:
 *
 *  - A sequence of polygon "rings" spaced along the Z axis, continuously
 *    moving toward the camera and recycling to the far end when they pass
 *    it — a genuine, continuous flythrough, not a one-shot expand-and-fade.
 *  - Adjacent rings are connected point-to-point by longitudinal struts —
 *    the tunnel's "cables" running the length of the structure.
 *  - A double-pulse ("lub-dub", like a real heartbeat) of brightness
 *    travels the length of every cable on a fixed rhythm — this is the
 *    literal "cables that beat like a heart" effect, not just a metaphor
 *    named in a label.
 *
 * Everything here is computed geometry; there is no video/3D-render asset
 * involved (none exists to use honestly), same reasoning as MatrixRain and
 * NetworkGlobe.
 */
const RING_SIDES = 16;
const RING_COUNT = 18;
const RING_SPACING = 2.2;
const TUNNEL_RADIUS = 1;
const CAMERA_Z = 0.4; // rings pass "through" the camera near this z
const FAR_Z = RING_COUNT * RING_SPACING;

// Heartbeat timing, in seconds, one full "lub-dub ... rest" cycle.
const BEAT_CYCLE = 1.9;
const BEAT_1_AT = 0;
const BEAT_2_AT = 0.22;
const BEAT_WIDTH = 0.16;
const PULSE_TRAVEL_TIME = 1.5; // seconds for a pulse to cross the whole tunnel

function ringPoints(sides: number): { x: number; y: number }[] {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    pts.push({ x: Math.cos(angle) * TUNNEL_RADIUS, y: Math.sin(angle) * TUNNEL_RADIUS });
  }
  return pts;
}

export function Tunnel({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const pts = ringPoints(RING_SIDES);
    // Each ring's current z and a slight per-ring rotation offset for a
    // gentle spiral twist along the tunnel's length.
    const rings = Array.from({ length: RING_COUNT }, (_, i) => ({
      z: FAR_Z - i * RING_SPACING,
      twist: i * 0.12,
    }));

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

    let pointerX = 0;
    let pointerY = 0;
    function handlePointerMove(e: PointerEvent) {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      pointerX = (e.clientX - rect.left) / rect.width - 0.5;
      pointerY = (e.clientY - rect.top) / rect.height - 0.5;
    }
    window.addEventListener("pointermove", handlePointerMove);

    let animationFrame: number;
    const start = performance.now();
    let lastFrameTime = start;
    const TUNNEL_SPEED = 0.9; // z-units per second

    function project(x: number, y: number, z: number, camX: number, camY: number) {
      const focal = 1.4;
      const zz = Math.max(z, 0.001);
      const perspective = focal / zz;
      return {
        x: width / 2 + (x - camX * zz * 0.4) * perspective * (width * 0.28),
        y: height / 2 + (y - camY * zz * 0.4) * perspective * (width * 0.28),
        scale: perspective,
      };
    }

    // Returns 0..1 brightness boost for a given distance-along-tunnel at
    // time `t`, implementing the repeating "lub-dub ... rest" heartbeat.
    function beatIntensity(distanceFrac: number, t: number): number {
      const cyclePos = (t / BEAT_CYCLE) % 1;
      // The pulse itself travels outward from the camera over
      // PULSE_TRAVEL_TIME — so a point further down the tunnel lights up
      // later than one close to the camera.
      const travelDelay = distanceFrac * (PULSE_TRAVEL_TIME / BEAT_CYCLE);
      const local = (cyclePos - travelDelay + 1) % 1;
      const d1 = Math.abs(local - BEAT_1_AT);
      const d2 = Math.abs(local - BEAT_2_AT);
      const nearest = Math.min(d1, d2, Math.abs(local - (BEAT_1_AT + 1)));
      return Math.max(0, 1 - nearest / BEAT_WIDTH);
    }

    function draw(now: number) {
      animationFrame = requestAnimationFrame(draw);
      if (!ctx) return;
      const elapsed = (now - start) / 1000;
      const deltaTime = Math.min((now - lastFrameTime) / 1000, 0.1);
      lastFrameTime = now;

      ctx.clearRect(0, 0, width, height);

      if (!prefersReducedMotion) {
        for (const ring of rings) {
          ring.z -= TUNNEL_SPEED * deltaTime;
        }
      }

      // Recycle rings that have passed the camera back to the far end —
      // this is what makes the flythrough continuous/infinite rather than
      // a one-shot animation.
      for (const ring of rings) {
        if (ring.z < CAMERA_Z) {
          ring.z += RING_COUNT * RING_SPACING;
        }
      }

      const sorted = [...rings].sort((a, b) => b.z - a.z);
      const camX = pointerX * 0.5;
      const camY = pointerY * 0.5;

      // Longitudinal cables: connect each ring to the next-closer ring at
      // the same angular point, carrying the traveling heartbeat pulse.
      for (let r = 0; r < sorted.length - 1; r++) {
        const ringA = sorted[r];
        const ringB = sorted[r + 1];
        const fracA = 1 - ringA.z / FAR_Z;
        const fracB = 1 - ringB.z / FAR_Z;
        const beat = beatIntensity((fracA + fracB) / 2, elapsed);

        for (let i = 0; i < pts.length; i++) {
          const angleA = ringA.twist;
          const angleB = ringB.twist;
          const cosA = Math.cos(angleA);
          const sinA = Math.sin(angleA);
          const cosB = Math.cos(angleB);
          const sinB = Math.sin(angleB);
          const pa = pts[i];
          const pb = pts[i];
          const ax = pa.x * cosA - pa.y * sinA;
          const ay = pa.x * sinA + pa.y * cosA;
          const bx = pb.x * cosB - pb.y * sinB;
          const by = pb.x * sinB + pb.y * cosB;

          const pA = project(ax, ay, ringA.z, camX, camY);
          const pB = project(bx, by, ringB.z, camX, camY);

          // Perspective-based falloff (brighter as a cable segment nears
          // the camera) instead of a hard linear cutoff, so the tunnel's
          // structure stays visibly lit all the way to the vanishing
          // point rather than fading to literally nothing partway down —
          // the traveling pulse should read as a *highlight* on an
          // already-visible structure, not the only reason anything is
          // visible at all.
          const baseOpacity = Math.min(0.55, 0.55 / (1 + ringA.z * 0.12));
          const opacity = Math.min(0.98, baseOpacity + beat * 0.8);
          const hue = beat > 0.4 ? "163, 230, 216" : "45, 212, 191";
          ctx.strokeStyle = `rgba(${hue}, ${opacity})`;
          ctx.lineWidth = 1 + beat * 1.8;
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();
        }
      }

      // Ring outlines themselves — same perspective falloff as the cables.
      for (const ring of sorted) {
        const frac = 1 - ring.z / FAR_Z;
        const beat = beatIntensity(frac, elapsed);
        const baseOpacity = Math.min(0.45, 0.45 / (1 + ring.z * 0.15));
        const opacity = baseOpacity + beat * 0.3;
        ctx.strokeStyle = `rgba(52, 211, 153, ${Math.min(0.75, opacity)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= pts.length; i++) {
          const p = pts[i % pts.length];
          const cos = Math.cos(ring.twist);
          const sin = Math.sin(ring.twist);
          const x = p.x * cos - p.y * sin;
          const y = p.x * sin + p.y * cos;
          const projected = project(x, y, ring.z, camX, camY);
          if (i === 0) ctx.moveTo(projected.x, projected.y);
          else ctx.lineTo(projected.x, projected.y);
        }
        ctx.stroke();
      }
    }

    animationFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`h-full w-full ${className}`}
    />
  );
}
