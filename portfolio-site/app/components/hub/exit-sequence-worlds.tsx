"use client";

/**
 * Three more displays, three more doorways (Round E — "six displays"):
 *
 *   ride    the key turns: the TFT's backlight comes up on its logo screen, it cuts to the dash
 *           and runs its self-test (every tell-tale lights, the rev arc sweeps to the red line and
 *           back, the digits flash), then the ride pulls away — revs, gears, speed and the trip
 *           screen tracing the route
 *   gamer   the monitor powers on: scanlines, the HUD slides in, the crosshair settles, ammo
 *           counts up, the radar sweeps — PRESS START
 *   artist  a canvas on linen: a landscape paints itself stroke by stroke in the world's palette,
 *           and the brush signs it
 *
 * Each one renders in three ways from the same markup: `still="boot"` (the server-rendered first
 * frame, alive in CSS), `still="final"` (the finished frame the hub shows on return), or playing
 * (a GSAP timeline that calls `onDone`).
 */
import gsap from "gsap";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ambient } from "@/lib/site/ambient-sound";
import { personaIdentity } from "@/lib/site/brand";
import { spectrumColor } from "@/lib/site/spectrum";
import type { World } from "./vr/state";
import { BootScreen, useOnce, useSkip } from "./exit-shared";

export type WorldSeqProps = {
  world: World;
  delay?: number;
  onDone?: () => void;
  boot?: boolean;
  /** A still frame instead of the sequence. */
  still?: "boot" | "final";
};

const noop = () => {};
/** Two decimals: Node and the browser can disagree on a sine's last digit, which is a hydration error. */
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// Ride: the TFT dash
// ---------------------------------------------------------------------------
const REV_LEN = 420; // the rev arc's path length (viewBox units), measured once below
const RING_LEN = 2 * Math.PI * 44;
const TELLS = ["ABS", "TC", "N", "!", "OIL", "HI"];
const ROUTE =
  "M 30 230 C 80 200, 110 120, 160 130 S 230 220, 280 170 S 330 60, 370 70";

export function DashExit({
  world,
  delay = 0,
  onDone = noop,
  boot,
  still,
}: WorldSeqProps) {
  const done = useOnce(onDone);
  useSkip(still ? noop : done);
  const root = useRef<HTMLDivElement>(null);
  const c = spectrumColor(world.t);
  const [booting, setBooting] = useState(!!boot || still === "boot");
  const final = still === "final";

  useEffect(() => {
    const el = root.current;
    if (!el || still) return;
    const rev = el.querySelector<SVGPathElement>("[data-rev]");
    const route = el.querySelector<SVGPathElement>("[data-route]");
    const rider = el.querySelector<SVGCircleElement>("[data-rider]");
    const speed = el.querySelector<HTMLElement>("[data-speed]");
    const gear = el.querySelector<HTMLElement>("[data-gear]");
    const trip = el.querySelector<HTMLElement>("[data-trip]");
    const ign = el.querySelector<HTMLElement>("[data-ign]");
    const ring = el.querySelector<SVGCircleElement>("[data-ign-ring]");
    const tells = Array.from(el.querySelectorAll<HTMLElement>("[data-tell]"));
    const routeLen = route?.getTotalLength() ?? 600;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => done(),
        delay: delay / 1000,
      });
      const bootEl = el.querySelector("[data-boot]");
      if (bootEl) {
        tl.to(bootEl, { opacity: 0, duration: 0.3 }, 0);
        tl.add(() => setBooting(false), 0.3);
      } else
        tl.fromTo(
          el,
          { opacity: 0, scale: 0.97 },
          { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" },
        );
      // Key on: the backlight comes up on the logo screen — the ring draws, the mark settles in.
      tl.add(() => ambient.chime(0.25), 0.1);
      if (ign) {
        tl.fromTo(ign, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" }, 0.1);
        if (ring) {
          ring.style.strokeDasharray = `${RING_LEN}`;
          ring.style.strokeDashoffset = `${RING_LEN}`;
          tl.to(ring, { strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut" }, 0.25);
        }
        tl.fromTo(ign.querySelector("[data-ign-mark]"), { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 0.45, ease: "power2.out" }, 0.4);
        tl.fromTo(ign.querySelector("[data-ign-sub]"), { opacity: 0, letterSpacing: "0.5em" }, { opacity: 1, letterSpacing: "0.28em", duration: 0.5, ease: "power2.out" }, 0.6);
        // …and cuts to the dash screen.
        tl.to(ign, { opacity: 0, duration: 0.16, ease: "power1.in" }, 1.3);
      }
      tl.set(el.querySelector("[data-body]"), { opacity: 1 }, 1.34);
      tl.from(el.querySelectorAll("[data-hd]"), { opacity: 0, duration: 0.2 }, 1.36);
      tl.from(el.querySelectorAll("[data-cell]"), { opacity: 0, duration: 0.22 }, 1.36);
      // Self-test: every tell-tale lights in turn, the digits flash, the rev arc sweeps to the red
      // line and falls back to idle; then the lamps go out — all but neutral and ABS.
      if (tells.length) {
        tl.to(tells, { opacity: 1, duration: 0.08, stagger: 0.05 }, 1.42);
        tl.to(tells.filter((_, i) => i !== 2 && i !== 0), { opacity: 0.18, duration: 0.2, stagger: 0.04 }, 2.4);
      }
      if (speed) {
        tl.add(() => {
          speed.textContent = "888";
          speed.style.opacity = "0.45";
        }, 1.42);
        tl.add(() => {
          speed.textContent = "0";
          speed.style.opacity = "";
        }, 2.45);
      }
      const r = { v: 0 };
      if (rev) {
        rev.style.strokeDasharray = `${REV_LEN}`;
        rev.style.strokeDashoffset = `${REV_LEN}`;
        tl.to(
          r,
          {
            v: 1,
            duration: 0.55,
            ease: "power2.in",
            onUpdate: () => {
              rev.style.strokeDashoffset = `${REV_LEN * (1 - r.v)}`;
            },
          },
          1.5,
        );
        tl.to(r, {
          v: 0.14,
          duration: 0.5,
          ease: "power3.out",
          onUpdate: () => {
            rev.style.strokeDashoffset = `${REV_LEN * (1 - r.v)}`;
          },
        });
      }
      tl.add(() => ambient.chime(0.5), "<-0.3");
      // Pulling away, honestly: the revs climb under throttle, each upshift drops them and the next
      // gear picks the speed up from where it was. Speed = revs × the gear's ratio; the trip adds up.
      const RATIO = [0, 0.0062, 0.0088, 0.0117, 0.0148]; // km/h per rpm, gears 1–4 (≈ 56 / 79 / 105 at the shift point)
      const REDLINE = 12000;
      const sim = { rpm: 1300, gear: 0, v: 0, trip: 0, last: 0 };
      const drive = { t: 0 };
      tl.to(drive, {
        t: 2.1,
        duration: 2.1,
        ease: "none",
        delay: 0.1,
        onUpdate: () => {
          const dt = drive.t - sim.last;
          sim.last = drive.t;
          if (dt <= 0) return;
          if (sim.gear === 0) {
            // Into first: the revs dip as the clutch bites; the neutral lamp goes out.
            sim.gear = 1;
            sim.rpm = 2400;
            if (tells[2]) tells[2].style.opacity = "0.18";
          }
          if (tells[0] && sim.v > 6) tells[0].style.opacity = "0.18"; // ABS: its self-test ends once rolling
          const throttle = 1 - sim.v / 140;
          sim.rpm += 7800 * throttle * dt;
          if (sim.rpm > 9000 && sim.gear < 4) {
            sim.gear += 1;
            sim.rpm = sim.v / RATIO[sim.gear];
          }
          sim.v = sim.rpm * RATIO[sim.gear];
          sim.trip += (sim.v / 3600) * dt * 4; // the trip screen counts a little quicker than real time
          if (speed) speed.textContent = String(Math.round(sim.v));
          if (gear) gear.textContent = String(sim.gear);
          if (trip) trip.textContent = `trip ${sim.trip.toFixed(1)} km`;
          if (rev) rev.style.strokeDashoffset = `${REV_LEN * (1 - Math.min(1, sim.rpm / REDLINE))}`;
        },
      }, ">");
      // The trip screen traces the route; the rider's dot runs it; the pins light as it passes.
      if (route) {
        route.style.strokeDasharray = `${routeLen}`;
        route.style.strokeDashoffset = `${routeLen}`;
        const q = { u: 0 };
        tl.to(
          q,
          {
            u: 1,
            duration: 1.3,
            ease: "power1.inOut",
            onUpdate: () => {
              route.style.strokeDashoffset = `${routeLen * (1 - q.u)}`;
              if (rider) {
                const pt = route.getPointAtLength(routeLen * q.u);
                rider.setAttribute("cx", pt.x.toFixed(1));
                rider.setAttribute("cy", pt.y.toFixed(1));
              }
            },
          },
          "<0.3",
        );
        tl.from(
          el.querySelectorAll("[data-pin]"),
          {
            scale: 0,
            transformOrigin: "center",
            opacity: 0,
            duration: 0.3,
            stagger: 0.35,
            ease: "back.out(2)",
          },
          "<0.15",
        );
      }
      tl.add(() => ambient.target());
      tl.fromTo(
        el,
        { boxShadow: `0 0 0 0 ${c}` },
        { boxShadow: `0 0 80px -10px ${c}`, duration: 0.35 },
        "<",
      );
      tl.to({}, { duration: 0.25 });
    }, el);
    return () => ctx.revert();
  }, [done, c, delay, still]);

  const bodyHidden = booting && !final;
  return (
    <div
      ref={root}
      className={`hub-exit hub-exit-dash ${booting ? "is-boot" : ""}`}
      style={
        {
          "--c": c,
          ...(final ? { boxShadow: `0 0 80px -10px ${c}` } : null),
        } as CSSProperties
      }
      role="presentation"
    >
      <div className="hub-exit-bar">
        <span /> <span /> <span />
        <b data-hd>trip · dawn run</b>
        <span className="dash-tells" data-hd aria-hidden>
          {TELLS.map((t, i) => (
            <i key={t} data-tell className={i === 3 ? "is-warn" : undefined} style={{ opacity: 0.18 }}>
              {t}
            </i>
          ))}
        </span>
      </div>
      <div
        className="dash-body"
        data-body
        style={bodyHidden ? { opacity: 0 } : undefined}
      >
        <div className="dash-left" data-cell>
          <svg className="dash-rev" viewBox="0 0 300 170" aria-hidden>
            <path
              d="M 30 150 A 120 120 0 0 1 270 150"
              fill="none"
              stroke="rgba(243,241,236,0.12)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              data-rev
              d="M 30 150 A 120 120 0 0 1 270 150"
              fill="none"
              stroke={c}
              strokeWidth="10"
              strokeLinecap="round"
              style={
                final
                  ? {
                      strokeDasharray: REV_LEN,
                      strokeDashoffset: REV_LEN * (1 - 0.3),
                    }
                  : { strokeDasharray: REV_LEN, strokeDashoffset: REV_LEN }
              }
            />
            {Array.from({ length: 13 }, (_, i) => {
              const a = Math.PI + (Math.PI * i) / 12;
              const r0 = 100;
              const r1 = i % 3 ? 92 : 86;
              return (
                <line
                  key={i}
                  x1={r2(150 + Math.cos(a) * r0)}
                  y1={r2(150 + Math.sin(a) * r0)}
                  x2={r2(150 + Math.cos(a) * r1)}
                  y2={r2(150 + Math.sin(a) * r1)}
                  stroke={i >= 10 ? c : "rgba(243,241,236,0.45)"}
                  strokeWidth={i % 3 ? 1.5 : 2.5}
                />
              );
            })}
            <text
              x="150"
              y="112"
              textAnchor="middle"
              fill="rgba(243,241,236,0.5)"
              fontSize="13"
              fontFamily="var(--font-geist-mono), monospace"
            >
              × 1000 rpm
            </text>
          </svg>
          <div className="dash-speed">
            <b data-speed>{final ? 84 : 0}</b>
            <i>km/h</i>
          </div>
          <div className="dash-gear">
            <span data-gear>{final ? "3" : "N"}</span>
            <em>gear</em>
          </div>
        </div>
        <div className="dash-right" data-cell>
          <svg className="dash-route" viewBox="0 0 400 300" aria-hidden>
            {[1, 2, 3].map((i) => (
              <line
                key={`v${i}`}
                x1={i * 100}
                x2={i * 100}
                y1={0}
                y2={300}
                stroke="rgba(243,241,236,0.06)"
              />
            ))}
            {[1, 2].map((i) => (
              <line
                key={`h${i}`}
                x1={0}
                x2={400}
                y1={i * 100}
                y2={i * 100}
                stroke="rgba(243,241,236,0.06)"
              />
            ))}
            <path
              d={ROUTE}
              fill="none"
              stroke={spectrumColor(world.t, 30)}
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.5}
            />
            <path
              data-route
              d={ROUTE}
              fill="none"
              stroke={c}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={
                final
                  ? undefined
                  : { strokeDasharray: 1000, strokeDashoffset: 1000 }
              }
            />
            {[
              [30, 230],
              [230, 185],
              [370, 70],
            ].map(([x, y], i) => (
              <g
                key={i}
                data-pin
                style={{ transformBox: "fill-box" } as CSSProperties}
              >
                <circle cx={x} cy={y} r="5" fill="#f3f1ec" />
                <circle
                  cx={x}
                  cy={y}
                  r="11"
                  fill="none"
                  stroke={c}
                  strokeWidth="1.5"
                />
              </g>
            ))}
            <circle
              data-rider
              cx={final ? 370 : 30}
              cy={final ? 70 : 230}
              r="6"
              fill={c}
              style={{ filter: `drop-shadow(0 0 8px ${c})` }}
            />
          </svg>
          <div className="dash-meta">
            <span data-trip>{final ? "trip 2.3 km" : "trip 0.0 km"}</span>
            <span>fuel ▮▮▮▮▯</span>
            <span>06:41</span>
          </div>
        </div>
      </div>
      {!still ? (
        <div className="dash-ignition" data-ign style={{ opacity: 0 }} aria-hidden>
          <svg viewBox="0 0 100 100" className="dash-ign-ring">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(243,241,236,0.1)" strokeWidth="1" />
            <circle data-ign-ring cx="50" cy="50" r="44" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" transform="rotate(-90 50 50)" />
          </svg>
          <b data-ign-mark>R</b>
          <small data-ign-sub>system check</small>
        </div>
      ) : null}
      {bodyHidden ? <BootScreen /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gamer: the monitor powers on
// ---------------------------------------------------------------------------
export function MonitorExit({
  world,
  delay = 0,
  onDone = noop,
  boot,
  still,
}: WorldSeqProps) {
  const done = useOnce(onDone);
  useSkip(still ? noop : done);
  const root = useRef<HTMLDivElement>(null);
  const c = spectrumColor(world.t);
  const handle = personaIdentity("gamer").handle ?? "gamer";
  const [booting, setBooting] = useState(!!boot || still === "boot");
  const final = still === "final";

  useEffect(() => {
    const el = root.current;
    if (!el || still) return;
    const ammo = el.querySelector<HTMLElement>("[data-ammo]");
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => done(),
        delay: delay / 1000,
      });
      const bootEl = el.querySelector("[data-boot]");
      if (bootEl) {
        tl.to(bootEl, { opacity: 0, duration: 0.25 }, 0);
        tl.add(() => setBooting(false), 0.25);
      } else
        tl.fromTo(
          el,
          { opacity: 0, scale: 0.97 },
          { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" },
        );
      // Power on: a thin line opens into the picture.
      tl.set(el.querySelector("[data-body]"), { opacity: 1 }, 0);
      tl.fromTo(
        el.querySelector("[data-pic]"),
        { scaleY: 0.004, scaleX: 0.6, opacity: 1 },
        { scaleY: 1, scaleX: 1, duration: 0.45, ease: "power3.out" },
        0.05,
      );
      tl.from(
        el.querySelectorAll("[data-hd]"),
        { opacity: 0, y: -6, duration: 0.25, stagger: 0.05 },
        "<0.1",
      );
      tl.add(() => ambient.chime(0.75), "<");
      // The HUD slides in from its corners; the crosshair settles.
      tl.from(
        el.querySelectorAll("[data-hud='tl']"),
        { x: -24, opacity: 0, duration: 0.35, ease: "power2.out" },
        "<0.1",
      );
      tl.from(
        el.querySelectorAll("[data-hud='tr']"),
        { x: 24, opacity: 0, duration: 0.35, ease: "power2.out" },
        "<0.05",
      );
      tl.from(
        el.querySelectorAll("[data-hud='br']"),
        { y: 16, opacity: 0, duration: 0.35, ease: "power2.out" },
        "<0.05",
      );
      tl.fromTo(
        el.querySelector("[data-cross]"),
        { scale: 2.2, rotate: 45, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
        "<-0.1",
      );
      tl.fromTo(
        el.querySelector("[data-hp]"),
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.7,
          ease: "power2.out",
          transformOrigin: "left",
        },
        "<",
      );
      const a = { v: 0 };
      tl.to(
        a,
        {
          v: 30,
          duration: 0.6,
          ease: "steps(30)",
          onUpdate: () => {
            if (ammo) ammo.textContent = `${Math.round(a.v)} / 90`;
          },
        },
        "<0.1",
      );
      tl.fromTo(
        el.querySelector("[data-sweep]"),
        { rotate: 0 },
        {
          rotate: 720,
          duration: 1.4,
          ease: "none",
          transformOrigin: "0% 100%",
        },
        "<-0.3",
      );
      tl.add(() => ambient.key());
      // PRESS START blinks, twice.
      tl.fromTo(
        el.querySelector("[data-start]"),
        { opacity: 0 },
        { opacity: 1, duration: 0.12, repeat: 3, yoyo: true, ease: "none" },
        ">-0.4",
      );
      tl.set(el.querySelector("[data-start]"), { opacity: 1 });
      tl.add(() => ambient.target());
      tl.fromTo(
        el,
        { boxShadow: `0 0 0 0 ${c}` },
        { boxShadow: `0 0 80px -10px ${c}`, duration: 0.35 },
        "<",
      );
      tl.to({}, { duration: 0.25 });
    }, el);
    return () => ctx.revert();
  }, [done, c, delay, still]);

  const bodyHidden = booting && !final;
  return (
    <div
      ref={root}
      className={`hub-exit hub-exit-game ${booting ? "is-boot" : ""}`}
      style={
        {
          "--c": c,
          ...(final ? { boxShadow: `0 0 80px -10px ${c}` } : null),
        } as CSSProperties
      }
      role="presentation"
    >
      <div className="hub-exit-bar">
        <span /> <span /> <span />
        <b data-hd>{handle}</b>
        <em data-hd>1440p · 165 Hz</em>
        <em data-hd>ranked</em>
      </div>
      <div
        className="game-body"
        data-body
        style={bodyHidden ? { opacity: 0 } : undefined}
      >
        <div
          className="game-pic"
          data-pic
          style={final ? undefined : { transform: "scaleY(0.004) scaleX(0.6)" }}
        >
          <div className="game-hud game-hud-tl" data-hud="tl">
            <i className="game-hp">
              <b
                data-hp
                style={final ? undefined : { transform: "scaleX(0)" }}
              />
            </i>
            <span>HP 100</span>
          </div>
          <svg
            className="game-map"
            data-hud="tr"
            viewBox="0 0 100 100"
            aria-hidden
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="rgba(0,0,0,0.35)"
              stroke="rgba(243,241,236,0.35)"
              strokeWidth="1.5"
            />
            <circle
              cx="50"
              cy="50"
              r="24"
              fill="none"
              stroke="rgba(243,241,236,0.15)"
              strokeWidth="1"
            />
            <line
              x1="50"
              y1="4"
              x2="50"
              y2="96"
              stroke="rgba(243,241,236,0.12)"
            />
            <line
              x1="4"
              y1="50"
              x2="96"
              y2="50"
              stroke="rgba(243,241,236,0.12)"
            />
            <path
              data-sweep
              d="M 50 50 L 50 4 A 46 46 0 0 1 82 18 Z"
              fill={c}
              opacity="0.45"
              style={
                {
                  transformOrigin: "50% 50%",
                  transformBox: "view-box",
                } as CSSProperties
              }
            />
            <circle cx="50" cy="50" r="2.5" fill="#f3f1ec" />
            <circle cx="66" cy="38" r="2" fill={c} />
            <circle cx="30" cy="64" r="2" fill={c} />
          </svg>
          <svg
            className="game-cross"
            data-cross
            viewBox="0 0 100 100"
            aria-hidden
            style={final ? undefined : { opacity: 0 }}
          >
            <circle
              cx="50"
              cy="50"
              r="22"
              fill="none"
              stroke="rgba(243,241,236,0.9)"
              strokeWidth="1.5"
            />
            <line
              x1="50"
              y1="14"
              x2="50"
              y2="36"
              stroke="#f3f1ec"
              strokeWidth="2"
            />
            <line
              x1="50"
              y1="64"
              x2="50"
              y2="86"
              stroke="#f3f1ec"
              strokeWidth="2"
            />
            <line
              x1="14"
              y1="50"
              x2="36"
              y2="50"
              stroke="#f3f1ec"
              strokeWidth="2"
            />
            <line
              x1="64"
              y1="50"
              x2="86"
              y2="50"
              stroke="#f3f1ec"
              strokeWidth="2"
            />
            <circle cx="50" cy="50" r="1.8" fill={c} />
          </svg>
          <div className="game-hud game-hud-br" data-hud="br">
            <b data-ammo>{final ? "30 / 90" : "0 / 90"}</b>
            <span>7.62 · auto</span>
          </div>
          <p
            className="game-start"
            data-start
            style={final ? undefined : { opacity: 0 }}
          >
            P R E S S &nbsp; S T A R T
          </p>
          <i className="game-scan" aria-hidden />
        </div>
      </div>
      {bodyHidden ? <BootScreen /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artist: the canvas paints itself
// ---------------------------------------------------------------------------
// A small landscape: wide translucent strokes, drawn in order (sky, far hills, sun, near hill, water,
// a tree, the signature). Path lengths are read from the DOM at run time.
// A small landscape in a palette around the world's hue (`dt` shifts the hue along the spectrum):
// a sky wash, far hills, the sun, a near hill, water, a tree, the signature. Drawn in this order.
const STROKES: Array<{ d: string; w: number; l: number; dt: number; a: number; dur: number }> = [
  { d: "M 20 70 C 200 40, 420 90, 780 60", w: 70, l: 74, dt: 0.07, a: 0.32, dur: 0.6 }, // sky wash
  { d: "M 10 130 C 180 100, 360 150, 790 120", w: 60, l: 66, dt: 0.05, a: 0.28, dur: 0.55 },
  { d: "M 0 250 C 120 180, 260 200, 400 230 S 640 260, 800 210", w: 26, l: 46, dt: -0.06, a: 0.8, dur: 0.6 }, // far hills
  { d: "M 0 300 C 160 240, 330 290, 520 262 S 720 232, 800 272", w: 30, l: 40, dt: -0.08, a: 0.85, dur: 0.6 },
  { d: "M 580 150 L 592 150", w: 66, l: 82, dt: 0.1, a: 0.95, dur: 0.4 }, // sun
  { d: "M 0 390 C 140 330, 300 380, 460 350 S 700 320, 800 372", w: 44, l: 34, dt: -0.11, a: 0.95, dur: 0.6 }, // near hill
  { d: "M 40 440 C 200 430, 380 450, 760 436", w: 16, l: 58, dt: 0.06, a: 0.45, dur: 0.45 }, // water
  { d: "M 160 420 L 160 330 M 160 350 C 120 330, 110 290, 150 270 C 200 250, 230 300, 175 345", w: 9, l: 22, dt: -0.14, a: 0.95, dur: 0.6 }, // tree
  { d: "M 640 470 c 10 -18, 22 -6, 30 -14 c 8 -8, 4 14, 16 6 c 10 -6, 18 -18, 30 -2", w: 3, l: 88, dt: 0, a: 0.9, dur: 0.5 }, // signature
];
const wrapT = (t: number) => ((t % 1) + 1) % 1;

export function CanvasExit({
  world,
  delay = 0,
  onDone = noop,
  boot,
  still,
}: WorldSeqProps) {
  const done = useOnce(onDone);
  useSkip(still ? noop : done);
  const root = useRef<HTMLDivElement>(null);
  const c = spectrumColor(world.t);
  const [booting, setBooting] = useState(!!boot || still === "boot");
  const final = still === "final";

  useEffect(() => {
    const el = root.current;
    if (!el || still) return;
    const paths = Array.from(
      el.querySelectorAll<SVGPathElement>("[data-stroke]"),
    );
    const brush = el.querySelector<HTMLElement>("[data-brush]");
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => done(),
        delay: delay / 1000,
      });
      const bootEl = el.querySelector("[data-boot]");
      if (bootEl) {
        tl.to(bootEl, { opacity: 0, duration: 0.3 }, 0);
        tl.add(() => setBooting(false), 0.3);
      } else
        tl.fromTo(
          el,
          { opacity: 0, scale: 0.97 },
          { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" },
        );
      tl.set(el.querySelector("[data-body]"), { opacity: 1 }, 0);
      tl.from(
        el.querySelectorAll("[data-hd]"),
        { opacity: 0, y: -6, duration: 0.25, stagger: 0.05 },
        "<0.05",
      );
      paths.forEach((p, i) => {
        const len = p.getTotalLength();
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len}`;
        const q = { u: 0 };
        tl.to(
          q,
          {
            u: 1,
            duration: STROKES[i].dur,
            ease: "power1.inOut",
            onUpdate: () => {
              p.style.strokeDashoffset = `${len * (1 - q.u)}`;
              if (brush) {
                const pt = p.getPointAtLength(len * q.u);
                brush.style.transform = `translate(${(pt.x / 800) * 100}%, ${(pt.y / 500) * 100}%)`;
                brush.style.setProperty("--bx", `${(pt.x / 800) * 100}%`);
                brush.style.setProperty("--by", `${(pt.y / 500) * 100}%`);
              }
            },
          },
          i === 0 ? "<0.1" : ">0.06",
        );
        if (i === 4 || i === 8) tl.add(() => ambient.key(), "<");
      });
      tl.to(brush, { opacity: 0, duration: 0.3 });
      tl.add(() => ambient.chime(1.25), "<");
      tl.fromTo(
        el,
        { boxShadow: `0 0 0 0 ${c}` },
        { boxShadow: `0 0 80px -10px ${c}`, duration: 0.35 },
        "<",
      );
      tl.to({}, { duration: 0.3 });
    }, el);
    return () => ctx.revert();
  }, [done, c, delay, still]);

  const bodyHidden = booting && !final;
  return (
    <div
      ref={root}
      className={`hub-exit hub-exit-art ${booting ? "is-boot" : ""}`}
      style={
        {
          "--c": c,
          ...(final ? { boxShadow: `0 0 80px -10px ${c}` } : null),
        } as CSSProperties
      }
      role="presentation"
    >
      <div className="hub-exit-bar">
        <span /> <span /> <span />
        <b data-hd>study · 01</b>
        <em data-hd>watercolour</em>
        <em data-hd>30 × 20</em>
      </div>
      <div
        className="art-body"
        data-body
        style={bodyHidden ? { opacity: 0 } : undefined}
      >
        <div className="art-canvas">
          <svg viewBox="0 0 800 500" preserveAspectRatio="none" aria-hidden>
            {STROKES.map((s, i) => (
              <path
                key={i}
                data-stroke
                d={s.d}
                fill="none"
                stroke={spectrumColor(wrapT(world.t + s.dt), s.l)}
                strokeWidth={s.w}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={s.a}
                style={
                  final
                    ? undefined
                    : { strokeDasharray: 4000, strokeDashoffset: 4000 }
                }
              />
            ))}
          </svg>
          {!final ? <i className="art-brush" data-brush aria-hidden /> : null}
        </div>
      </div>
      {bodyHidden ? <BootScreen /> : null}
    </div>
  );
}
