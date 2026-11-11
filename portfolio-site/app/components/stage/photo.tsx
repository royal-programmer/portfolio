"use client";

/**
 * The Stage's photo mode (S6). `PhotoCapture` lives inside the canvas and renders the scene on demand at the
 * capture size (the canvas is resized for one synchronous render, drawn into a 2D canvas, then put back, so the
 * picture has exactly the look of the screen, tone mapping included). `PhotoOverlay` is the DOM half: the dimmed
 * page, the 1200 x 630 crop guide, the orbit by drag or arrow keys, Capture, then Download / Share.
 */
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { STAGE_PHOTO } from "@/lib/site/stage-data";

/** The orbit the visitor asked for (target, radians) and the eased value the rig applies. */
export type PhotoState = { on: boolean; ty: number; tp: number; y: number; p: number };
export const createPhoto = (): PhotoState => ({ on: false, ty: 0, tp: 0, y: 0, p: 0 });

export type CaptureRect = { x: number; y: number; w: number; h: number };
export type CaptureFn = (rect: CaptureRect) => HTMLCanvasElement | null;

const RAD = Math.PI / 180;

/** Inside the canvas: registers the capture function. */
export function PhotoCapture({ capture }: { capture: MutableRefObject<CaptureFn | null> }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    capture.current = (rect) => {
      const { gl, scene, camera } = get();
      const cam = camera as THREE.PerspectiveCamera;
      const prev = gl.getSize(new THREE.Vector2());
      const dpr = gl.getPixelRatio();
      const out = document.createElement("canvas");
      out.width = STAGE_PHOTO.w;
      out.height = STAGE_PHOTO.h;
      const g = out.getContext("2d");
      if (!g) return null;
      try {
        gl.setPixelRatio(1);
        gl.setSize(STAGE_PHOTO.w, STAGE_PHOTO.h, false);
        cam.setViewOffset(prev.x, prev.y, rect.x, rect.y, rect.w, rect.h);
        gl.render(scene, cam);
        g.drawImage(gl.domElement, 0, 0);
      } finally {
        cam.clearViewOffset();
        gl.setPixelRatio(dpr);
        gl.setSize(prev.x, prev.y, false);
      }
      return out;
    };
    return () => {
      capture.current = null;
    };
  }, [get, capture]);
  return null;
}

const fontOf = (name: string, fallback: string) => {
  try {
    const v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v ? `${v}, ${fallback}` : fallback;
  } catch {
    return fallback;
  }
};

/** The scene's picture plus the name strip at the bottom: display face for the name, mono for the rest, the accent rule on top. */
async function compose(shot: HTMLCanvasElement, accent: string): Promise<Blob | null> {
  const { w, h } = STAGE_PHOTO;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const g = out.getContext("2d");
  if (!g) return null;
  // The stage's own backdrop (the canvas is transparent), then the scene.
  g.fillStyle = "#07070a";
  g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w / 2, h * 0.6, 0, w / 2, h * 0.6, w * 0.6);
  glow.addColorStop(0, accent);
  glow.addColorStop(1, "rgba(7,7,10,0)");
  g.globalAlpha = 0.2;
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  g.drawImage(shot, 0, 0);
  const display = fontOf("--font-fraunces", "Georgia, serif");
  const mono = fontOf("--font-geist-mono", "ui-monospace, monospace");
  try {
    await Promise.all([document.fonts.load(`600 30px ${display}`), document.fonts.load(`500 20px ${mono}`)]);
  } catch {}
  const bar = 68;
  g.fillStyle = "rgba(7,7,10,0.86)";
  g.fillRect(0, h - bar, w, bar);
  g.fillStyle = accent;
  g.fillRect(0, h - bar, w, 4);
  g.textBaseline = "middle";
  const y = h - bar / 2 + 2;
  g.font = `600 30px ${display}`;
  g.fillStyle = "#f2efe8";
  const first = STAGE_PHOTO.caption.name;
  g.fillText(first, 36, y);
  const x = 36 + g.measureText(first).width;
  g.font = `500 20px ${mono}`;
  g.fillStyle = "#b9b6ae";
  g.fillText(` · ${STAGE_PHOTO.caption.role} · `, x, y);
  const x2 = x + g.measureText(` · ${STAGE_PHOTO.caption.role} · `).width;
  g.fillStyle = accent;
  g.fillText(STAGE_PHOTO.caption.url, x2, y);
  return new Promise((res) => out.toBlob((b) => res(b), "image/png"));
}

type Rect = { x: number; y: number; w: number; h: number };

export function PhotoOverlay({ boxRef, photo, capture, accent, shareUrl, onClose }: { boxRef: MutableRefObject<HTMLElement | null>; photo: MutableRefObject<PhotoState>; capture: MutableRefObject<CaptureFn | null>; accent: string; shareUrl: string; onClose: () => void }) {
  const [canvasRect, setCanvasRect] = useState<Rect | null>(null);
  const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const shotRef = useRef(shot);
  useEffect(() => {
    shotRef.current = shot;
  }, [shot]);

  const measure = useCallback(() => {
    const c = boxRef.current?.querySelector("canvas") ?? boxRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    setCanvasRect({ x: r.left, y: r.top, w: r.width, h: r.height });
  }, [boxRef]);

  useEffect(() => {
    const box = boxRef.current;
    const inView = box ? box.getBoundingClientRect() : null;
    if (inView && (inView.top < 8 || inView.bottom > window.innerHeight - 8)) box?.scrollIntoView({ block: "center", behavior: "auto" });
    const id = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    document.documentElement.setAttribute("data-stage-photo", "");
    const p = photo.current;
    p.on = true;
    p.ty = 0;
    p.tp = 0;
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
      document.documentElement.removeAttribute("data-stage-photo");
      p.on = false;
      p.ty = 0;
      p.tp = 0;
    };
  }, [boxRef, measure, photo]);

  useEffect(() => () => {
    if (shotRef.current) URL.revokeObjectURL(shotRef.current.url);
  }, []);

  const orbit = useCallback(
    (dy: number, dp: number) => {
      const p = photo.current;
      p.ty = Math.max(-STAGE_PHOTO.yaw * RAD, Math.min(STAGE_PHOTO.yaw * RAD, p.ty + dy));
      p.tp = Math.max(-STAGE_PHOTO.pitch * RAD, Math.min(STAGE_PHOTO.pitch * RAD, p.tp + dp));
    },
    [photo],
  );

  const back = useCallback(() => {
    setShot((s) => {
      if (s) URL.revokeObjectURL(s.url);
      return null;
    });
    setNote("");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (shotRef.current) back();
        else onClose();
      } else if (!shotRef.current && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const s = 3 * RAD;
        if (e.key === "ArrowLeft") orbit(-s, 0);
        else if (e.key === "ArrowRight") orbit(s, 0);
        else if (e.key === "ArrowUp") orbit(0, s);
        else orbit(0, -s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, onClose, orbit]);

  // The page does not scroll under the frame.
  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", stop, { passive: false });
    el.addEventListener("touchmove", stop, { passive: false });
    return () => {
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchmove", stop);
    };
  }, []);

  const drag = useRef<{ x: number; y: number } | null>(null);
  const guide: Rect | null = canvasRect
    ? (() => {
        const m = 16;
        const ar = STAGE_PHOTO.w / STAGE_PHOTO.h;
        const aw = Math.max(40, canvasRect.w - m * 2);
        const ah = Math.max(40, canvasRect.h - m * 2);
        const w = Math.min(aw, ah * ar);
        const h = w / ar;
        return { x: canvasRect.x + (canvasRect.w - w) / 2, y: canvasRect.y + (canvasRect.h - h) / 2, w, h };
      })()
    : null;

  const take = async () => {
    if (!guide || !canvasRect || busy) return;
    setBusy(true);
    try {
      const raw = capture.current?.({ x: guide.x - canvasRect.x, y: guide.y - canvasRect.y, w: guide.w, h: guide.h });
      if (!raw) throw new Error("no capture");
      const blob = await compose(raw, accent);
      if (!blob) throw new Error("no blob");
      setShot({ url: URL.createObjectURL(blob), blob });
      setNote("");
    } catch {
      setNote("Could not take the picture on this device.");
    }
    setBusy(false);
  };
  const download = () => {
    if (!shot) return;
    const a = document.createElement("a");
    a.href = shot.url;
    a.download = STAGE_PHOTO.file;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const share = async () => {
    if (!shot) return;
    const file = new File([shot.blob], STAGE_PHOTO.file, { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Ratul Roy · stage", url: shareUrl });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNote("Link copied: " + shareUrl);
    } catch {
      setNote(shareUrl);
    }
  };

  return createPortal(
    <div
      ref={layer}
      role="dialog"
      aria-label="Photo mode"
      className="stage-photo"
      style={{ ["--stage-c" as string]: accent }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        drag.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || shot) return;
        orbit(-(e.clientX - d.x) * 0.0035, (e.clientY - d.y) * 0.0035);
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      {canvasRect ? <div className="stage-photo-dim" style={{ left: canvasRect.x, top: canvasRect.y, width: canvasRect.w, height: canvasRect.h }} /> : null}
      {guide && !shot ? (
        <div className="stage-photo-guide" style={{ left: guide.x, top: guide.y, width: guide.w, height: guide.h }} aria-hidden>
          <span>1200 × 630</span>
        </div>
      ) : null}
      {shot ? (
        <div className="stage-photo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL made in the browser */}
          <img src={shot.url} alt="The captured stage, 1200 by 630" width={STAGE_PHOTO.w} height={STAGE_PHOTO.h} />
        </div>
      ) : null}
      <div className="stage-photo-bar">
        {shot ? (
          <>
            <button type="button" onClick={download}>
              Download
            </button>
            <button type="button" onClick={share}>
              Share
            </button>
            <button type="button" onClick={back}>
              Retake
            </button>
          </>
        ) : (
          <>
            <button type="button" className="is-primary" onClick={take} disabled={busy || !guide} autoFocus>
              {busy ? "Capturing" : "Capture"}
            </button>
            <button type="button" onClick={onClose}>
              Close · Esc
            </button>
          </>
        )}
        <span className="stage-photo-note" role="status">
          {note || (shot ? "" : "Drag or arrow keys to turn the view")}
        </span>
      </div>
    </div>,
    document.body,
  );
}
