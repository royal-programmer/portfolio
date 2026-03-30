"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type HomeHeaderProps = {
  onLogoPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onLogoPointerUp: () => void;
};

/** How long each image stays visible before crossfading to the other */
const ROTATE_INTERVAL_MS = 2000;
const CROSSFADE_MS = 700;

export function HomeHeader({ onLogoPointerDown, onLogoPointerUp }: HomeHeaderProps) {
  const [showMark, setShowMark] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => setShowMark((v) => !v), ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  /** Static avatar when user prefers reduced motion */
  const showRMark = reducedMotion ? false : showMark;

  return (
    <header className="relative z-[55] mx-auto w-full max-w-6xl px-3 pb-0 pt-1.5 md:px-10 md:pt-2.5">
      <div className="relative inline-flex">
        <span
          className="pointer-events-none absolute -inset-4 rounded-full opacity-75 blur-2xl"
          style={{
            background:
              "radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--accent) 50%, transparent), transparent 65%)",
          }}
          aria-hidden
        />
        <button
          type="button"
          onPointerDown={onLogoPointerDown}
          onPointerUp={onLogoPointerUp}
          onPointerCancel={onLogoPointerUp}
          onPointerLeave={onLogoPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className="group relative flex h-[4.75rem] w-[4.75rem] shrink-0 select-none items-stretch justify-stretch rounded-full p-[3px] transition-[transform,filter] [-webkit-touch-callout:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] active:scale-[0.96] md:h-[5.25rem] md:w-[5.25rem] md:p-[3.5px]"
          style={{
            touchAction: "manipulation",
            WebkitTouchCallout: "none",
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.65) 0%, color-mix(in srgb, var(--accent) 55%, rgba(255,255,255,0.2)) 38%, color-mix(in srgb, var(--accent) 25%, rgba(15,23,42,0.85)) 100%)",
            boxShadow: `
              0 24px 52px rgba(0, 0, 0, 0.45),
              0 12px 28px color-mix(in srgb, var(--accent) 28%, transparent),
              0 0 0 1px rgba(255, 255, 255, 0.08),
              inset 0 1px 0 rgba(255, 255, 255, 0.35)
            `,
          }}
          aria-label="Portfolio profile — hold to switch persona"
          title="Hold to cycle Engineer → Trader → Photographer"
        >
          <span
            className="relative min-h-0 min-w-0 flex-1 select-none overflow-hidden rounded-full bg-black [-webkit-touch-callout:none]"
            style={{
              boxShadow: "inset 0 4px 16px rgba(255,255,255,0.22), inset 0 -12px 32px rgba(0,0,0,0.38)",
              WebkitTouchCallout: "none",
            }}
          >
            <span className="absolute inset-0 transition-transform duration-300 ease-out group-hover:scale-[1.04]">
              <span className="absolute inset-0 overflow-hidden rounded-full">
                <Image
                  src="/R.jpg"
                  alt=""
                  fill
                  draggable={false}
                  sizes="(max-width: 768px) 84px, 84px"
                  className={`pointer-events-none select-none object-contain object-center scale-[1] transition-opacity ease-out [-webkit-user-drag:none] ${
                    showRMark ? "opacity-100" : "opacity-0"
                  }`}
                  style={{
                    transitionDuration: reducedMotion ? "0ms" : `${CROSSFADE_MS}ms`,
                    WebkitTouchCallout: "none",
                    userSelect: "none",
                  }}
                  priority
                />
              </span>
              <span className="absolute inset-0">
                <Image
                  src="/profile-cartoon-avatar.png"
                  alt=""
                  fill
                  draggable={false}
                  sizes="(max-width: 768px) 76px, 84px"
                  className={`pointer-events-none select-none object-cover transition-opacity ease-out [-webkit-user-drag:none] ${
                    showRMark ? "opacity-0" : "opacity-100"
                  }`}
                  style={{
                    transitionDuration: reducedMotion ? "0ms" : `${CROSSFADE_MS}ms`,
                    WebkitTouchCallout: "none",
                    userSelect: "none",
                  }}
                />
              </span>
            </span>
            <span
              className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/22 via-transparent to-transparent opacity-90"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute inset-0 rounded-full opacity-35 mix-blend-multiply"
              style={{
                background:
                  "radial-gradient(circle at 32% 20%, transparent 35%, rgba(0,0,0,0.6) 100%)",
              }}
              aria-hidden
            />
          </span>
        </button>
      </div>
    </header>
  );
}
