"use client";

import { useEffect, useRef } from "react";

/**
 * A real, continuously-rotating 3D wireframe network — nodes distributed
 * on a sphere and connected to their nearest neighbors, rendered with hand-
 * written 3D-to-2D perspective projection on a plain 2D canvas (no Three.js
 * or other WebGL dependency pulled in just for this one visual — that
 * would meaningfully grow the JS bundle for every visitor of the marketing
 * page). Every node/edge position is computed math, not a pre-rendered
 * image or video — same "generate it for real, don't fake an asset"
 * approach as `MatrixRain.tsx`.
 *
 * Doubles as an honest visual metaphor for the actual product: nodes are
 * "assets," edges are "how they connect" — literally what attack-surface
 * discovery maps out.
 */
interface Point3D {
  x: number;
  y: number;
  z: number;
}

const NODE_COUNT = 60;
const CONNECT_DISTANCE = 0.55;

function fibonacciSphere(count: number): Point3D[] {
  const points: Point3D[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    points.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    });
  }
  return points;
}

export function NetworkGlobe({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const nodes = fibonacciSphere(NODE_COUNT);
    const edges: [number, number][] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dz = nodes[i].z - nodes[j].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < CONNECT_DISTANCE) edges.push([i, j]);
      }
    }

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

    let rotationY = 0;
    let rotationX = 0.3;
    let targetTiltX = 0.3;
    let targetTiltY = 0;

    function handlePointerMove(e: PointerEvent) {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      targetTiltY = relX * 0.6;
      targetTiltX = 0.3 + relY * 0.4;
    }
    window.addEventListener("pointermove", handlePointerMove);

    let animationFrame: number;

    function draw() {
      animationFrame = requestAnimationFrame(draw);
      if (!ctx) return;

      if (!prefersReducedMotion) {
        rotationY += 0.0025;
      }
      rotationX += (targetTiltX - rotationX) * 0.04;
      const smoothedTiltY = rotationY + targetTiltY;

      ctx.clearRect(0, 0, width, height);

      const scale = Math.min(width, height) * 0.42;
      const cx = width / 2;
      const cy = height / 2;
      const focalLength = 3.2;

      const projected = nodes.map((p) => {
        // Rotate around Y then X.
        const cosY = Math.cos(smoothedTiltY);
        const sinY = Math.sin(smoothedTiltY);
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;

        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        const perspective = focalLength / (focalLength + z2);
        return {
          x: cx + x1 * scale * perspective,
          y: cy + y2 * scale * perspective,
          scale: perspective,
          z: z2,
        };
      });

      // Edges first (behind nodes).
      for (const [a, b] of edges) {
        const pa = projected[a];
        const pb = projected[b];
        const avgZ = (pa.z + pb.z) / 2;
        const opacity = Math.max(0, Math.min(0.5, 0.32 + avgZ * 0.35));
        ctx.strokeStyle = `rgba(99, 179, 237, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // Nodes, sorted back-to-front so nearer nodes draw on top.
      const order = projected
        .map((p, i) => ({ p, i }))
        .sort((a, b) => a.p.z - b.p.z);
      for (const { p } of order) {
        const radius = 2.2 * p.scale;
        const opacity = Math.max(0.25, Math.min(1, 0.5 + p.z * 0.6));
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(129, 230, 217, ${opacity})`;
        ctx.shadowColor = "rgba(52, 211, 153, 0.8)";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
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
