"use client";

import { useEffect, useRef } from "react";

// A real, procedurally-generated "digital rain" canvas animation — no
// image/video asset involved (there's no real footage or 3D render to use
// honestly, so this is generated code, not a faked asset pretending to be
// something it isn't). Deliberately kept as a low-opacity background layer
// behind real content, not the whole page, so it reads as an accent — the
// non-technical small-business audience this redesign also targets should
// feel reassured, not like they've wandered into a hacker movie.
const CHARACTERS =
  "01アイウエオカキクケコサシスセソタチツテトABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function MatrixRain({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect the user's motion preference — this is a decorative accent,
    // never load-bearing content, so it's fine to simply not animate it.
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fontSize = 16;
    let columns = 0;
    let drops: number[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;

    function resize() {
      const canvasEl = canvasRef.current;
      if (!canvasEl || !ctx) return;
      const rect = canvasEl.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvasEl.width = width * dpr;
      canvasEl.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(width / fontSize);
      drops = Array.from({ length: columns }, () =>
        Math.floor((Math.random() * height) / fontSize),
      );
    }

    resize();
    window.addEventListener("resize", resize);

    let animationFrame: number;
    let lastTime = 0;
    const frameInterval = 1000 / 20; // ~20fps is plenty for this effect

    function draw(time: number) {
      animationFrame = requestAnimationFrame(draw);
      if (time - lastTime < frameInterval) return;
      lastTime = time;
      if (!ctx) return;

      // Fading black overlay creates the trailing-streak look instead of
      // clearing the canvas outright every frame.
      ctx.fillStyle = "rgba(2, 6, 12, 0.15)";
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < columns; i++) {
        const char = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        // Brighter leading character, dimmer green trail — same emerald
        // family already used elsewhere in this app for "safe/good" signal
        // colors, so it doesn't introduce a clashing new hue.
        ctx.fillStyle = "rgba(52, 211, 153, 0.85)";
        ctx.fillText(char, x, y);

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        } else {
          drops[i]++;
        }
      }
    }

    animationFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
