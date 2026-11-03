"use client";

/**
 * A point of light for a cursor (fine pointers only). The dot tracks the
 * pointer almost 1:1 and the ring follows with a short, frame-rate-independent
 * ease — smooth, never laggy. Over links the ring opens and takes the link's
 * colour (`data-cursor-color`); while holding it contracts ("time slows").
 */
import { useEffect, useRef } from "react";

export function LightCursor({ holdHint }: { holdHint?: string }) {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const root = document.documentElement;
    root.classList.add("has-light-cursor");
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const d = { ...target };
    const r = { ...target };
    let visible = false;
    let raf = 0;
    let last = performance.now();

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        visible = true;
        d.x = r.x = e.clientX;
        d.y = r.y = e.clientY;
        root.classList.add("light-cursor-visible");
      }
      const el = (e.target as Element | null)?.closest?.("a, button, [role='radio'], input, label, [data-cursor]");
      ring.current?.classList.toggle("is-link", !!el);
      const color = (el as HTMLElement | null)?.dataset?.cursorColor;
      ring.current?.style.setProperty("--cc", color ?? "var(--ink)");
    };
    const leave = () => {
      visible = false;
      root.classList.remove("light-cursor-visible");
    };
    const down = () => ring.current?.classList.add("is-down");
    const up = () => ring.current?.classList.remove("is-down");

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const kd = 1 - Math.exp(-dt * 40);
      const kr = 1 - Math.exp(-dt * 14);
      d.x += (target.x - d.x) * kd;
      d.y += (target.y - d.y) * kd;
      r.x += (target.x - r.x) * kr;
      r.y += (target.y - r.y) * kr;
      if (dot.current) dot.current.style.transform = `translate3d(${d.x}px, ${d.y}px, 0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      root.classList.remove("has-light-cursor", "light-cursor-visible");
    };
  }, []);

  return (
    <>
      <div ref={ring} aria-hidden className="light-cursor-ring">
        <span>{holdHint}</span>
      </div>
      <div ref={dot} aria-hidden className="light-cursor-dot" />
    </>
  );
}
