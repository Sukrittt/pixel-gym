"use client";
import { useEffect, useRef, useState } from "react";
import type { Zone } from "@/lib/exercises";
import { tagFor, type EmoteKind, type FloorView, type MemberView } from "@/lib/floor";
import { drawText, textWidth } from "@/lib/font";
import { spriteCanvas, strength, type Pose } from "@/lib/sprite";
import {
  drawBackground, drawDynamic, drawFame, drawSign, drawWindows, findPath, randomTileIn,
  SIGNS, SPAWN, SPOTS, WH, WW, type Pt,
} from "@/lib/world";

type Act = "work" | "drink" | "phone" | "wander";
type Agent = {
  id: string;
  x: number;
  y: number;
  path: Pt[];
  zone: Zone;
  spot: Pt;
  rack: number;
  act: Act;
  actUntil: number;
  seed: number;
  emote?: { kind: EmoteKind; from: string; until: number };
};

const SPEED = 42; // px per second
const WORK_ZONES: Zone[] = ["weights", "squat", "cardio", "mat"];

function rnd(a: Agent) {
  a.seed = (a.seed * 1103515245 + 12345) & 0x7fffffff;
  return a.seed / 0x7fffffff;
}

function zoneOf(m: MemberView): Zone {
  return m.today ? m.today.zone : m.planToday === "" ? "lockers" : "outside";
}

/** Stable spot per member: members in a zone sorted by id get spots in order. */
function assignSpots(members: MemberView[]) {
  const byZone = new Map<Zone, MemberView[]>();
  for (const m of members) byZone.set(zoneOf(m), [...(byZone.get(zoneOf(m)) ?? []), m]);
  const out = new Map<string, { zone: Zone; spot: Pt; rack: number }>();
  for (const [zone, ms] of byZone) {
    ms.sort((a, b) => a.id.localeCompare(b.id));
    ms.forEach((m, i) => {
      const spots = SPOTS[zone];
      const base = spots[i % spots.length];
      const lap = Math.floor(i / spots.length);
      out.set(m.id, { zone, spot: { x: base.x + lap * 10, y: base.y + lap * 3 }, rack: zone === "squat" && i < 4 ? i : -1 });
    });
  }
  return out;
}

const EMOTE_ICONS: Record<EmoteKind, string[]> = {
  bump: ["..ooo....", ".ooooo...", "oooooooo.", "oooooooo.", ".oooooo..", "..oooo..."],
  flex: ["...oo....", "..o..o...", "..o..o...", ".ooooo...", "ooooooo..", "oooooooo."],
  clap: ["o.o..o.o.", ".o....o..", "oo....oo.", "ooo..ooo.", ".oo..oo..", "..o..o..."],
};

function poseFor(a: Agent, m: MemberView, t: number): Pose {
  const strong = strength(m.params) > 6.5;
  if (a.path.length) {
    const f = Math.floor(t / 130) % 4;
    return { legs: (["stepA", "stand", "stepB", "stand"] as const)[f], arms: f < 2 ? ["swingF", "swingB"] : ["swingB", "swingF"], bounce: strong && f % 2 === 0 ? -1 : 0 };
  }
  if (a.zone === "outside") return { legs: "sit", arms: ["down", "hold"], prop: "phone", propHand: 1, lookDown: true };
  if (a.act === "drink") return { legs: "stand", arms: ["down", "hold"], prop: "bottle", propHand: 1 };
  if (a.act === "phone") return { legs: "stand", arms: ["down", "hold"], prop: "phone", propHand: 1, lookDown: true };
  if (a.act === "wander") return { legs: "stand", arms: ["down", "down"] };
  const focus = m.today?.focus;
  switch (a.zone) {
    case "weights": {
      const up = Math.floor(t / 700) % 2 === 0;
      if (focus === "Push") return { legs: "stand", arms: up ? ["up", "up"] : ["curl", "curl"], prop: "dumbbell" };
      if (focus === "Pull") return { legs: "stand", arms: up ? ["hold", "hold"] : ["down", "down"], prop: "dumbbell" };
      return { legs: "stand", arms: up ? ["curl", "down"] : ["down", "curl"], prop: "dumbbell" };
    }
    case "squat":
      return { legs: Math.floor(t / 900) % 2 ? "squat" : "stand", arms: ["bar", "bar"], prop: "barbell" };
    case "cardio": {
      const pace = m.today && m.today.cardioMin > 0 ? (m.today.km / m.today.cardioMin) * 60 : 8; // km/h
      const ms = Math.max(60, 260 - pace * 16);
      const f = Math.floor(t / ms) % 4;
      return { legs: (["stepA", "stand", "stepB", "stand"] as const)[f], arms: f < 2 ? ["swingF", "swingB"] : ["swingB", "swingF"], bounce: f % 2 === 0 ? -1 : 0 };
    }
    case "mat":
      return Math.floor(t / 2000) % 2 ? { legs: "stand", arms: ["up", "up"] } : { legs: "sit", arms: ["down", "down"] };
    case "bar":
      return { legs: "stand", arms: ["down", "hold"], prop: "bottle", propHand: 1 };
    default:
      return { legs: "stand", arms: ["down", "down"] };
  }
}

function drawEmote(ctx: CanvasRenderingContext2D, kind: EmoteKind, from: string, x: number, y: number) {
  const label = from.toUpperCase().slice(0, 8);
  const w = Math.max(16, textWidth(label) + 6);
  const bx = Math.round(x - w / 2), by = y - 22;
  ctx.fillStyle = "#2a1c16";
  ctx.fillRect(bx - 1, by - 1, w + 2, 20);
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(bx, by, w, 18);
  ctx.fillRect(x - 1, by + 18, 3, 2);
  ctx.fillStyle = "#e0a32a";
  EMOTE_ICONS[kind].forEach((row, j) => [...row].forEach((c, i) => c === "o" && ctx.fillRect(bx + w / 2 - 4 + i, by + 2 + j, 1, 1)));
  drawText(ctx, label, bx + 3, by + 11, "#2a1c16");
}

export default function FloorCanvas({ view, meId, onSelect }: { view: FloorView; meId?: string; onSelect?: (m: MemberView) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const agents = useRef(new Map<string, Agent>());
  const viewRef = useRef(view);
  const seenEmotes = useRef(new Set<string>());
  // null = auto: fit on wide screens, 2x (readable tags) + pan on phones
  const [zoom, setZoom] = useState<number | "fit" | null>(null);
  const [fitW, setFitW] = useState(WW);
  // fit-to-width unless that makes pixels tiny (phones): then 1x and pan
  const fitScale = fitW / WW;
  const auto = fitScale < 0.85 ? 2 : "fit";
  const eff = zoom ?? auto;
  const scale = eff === "fit" ? fitScale : eff;
  const scaleRef = useRef(scale);
  const followed = useRef(false);
  useEffect(() => {
    scaleRef.current = scale;
    followed.current = false; // re-center on you after a zoom change
  }, [scale]);

  // sync agents with the latest floor data: new zone = walk there
  useEffect(() => {
    viewRef.current = view;
    const spots = assignSpots(view.members);
    const now = performance.now();
    for (const m of view.members) {
      const s = spots.get(m.id)!;
      let a = agents.current.get(m.id);
      if (!a) {
        const start = s.zone === "outside" ? s.spot : { x: SPAWN.x + (m.id.length % 3) * 4, y: SPAWN.y };
        a = { id: m.id, ...start, path: [], zone: s.zone, spot: s.spot, rack: s.rack, act: "work", actUntil: now + 8000, seed: [...m.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) & 0x7fffffff };
        agents.current.set(m.id, a);
        if (s.zone !== "outside") a.path = findPath(a, s.spot);
      } else if (a.zone !== s.zone || a.spot.x !== s.spot.x || a.spot.y !== s.spot.y) {
        Object.assign(a, { zone: s.zone, spot: s.spot, rack: s.rack, act: "work" as Act });
        a.path = findPath(a, s.spot);
      }
    }
    for (const id of [...agents.current.keys()]) if (!view.members.some((m) => m.id === id)) agents.current.delete(id);
    for (const e of view.emotes) {
      if (seenEmotes.current.has(e.id)) continue;
      seenEmotes.current.add(e.id);
      const a = agents.current.get(e.to);
      const from = view.members.find((m) => m.id === e.from)?.name ?? e.from;
      if (a) a.emote = { kind: e.kind, from, until: now + 8000 };
    }
  }, [view]);

  // fit-to-width zoom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFitW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // render loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const bg = document.createElement("canvas");
    bg.width = WW;
    bg.height = WH;
    drawBackground(bg.getContext("2d")!);
    let raf = 0;
    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const v = viewRef.current;
      const byId = new Map(v.members.map((m) => [m.id, m]));
      const wall = Date.now();
      // update
      for (const a of agents.current.values()) {
        if (a.path.length) {
          const n = a.path[0];
          const dx = n.x - a.x, dy = n.y - a.y, d = Math.hypot(dx, dy);
          const step = SPEED * dt;
          if (d <= step) {
            a.x = n.x;
            a.y = n.y;
            a.path.shift();
          } else {
            a.x += (dx / d) * step;
            a.y += (dy / d) * step;
          }
          continue;
        }
        if (t > a.actUntil && a.zone !== "outside") {
          const r = rnd(a);
          const atSpot = Math.hypot(a.x - a.spot.x, a.y - a.spot.y) < 2;
          if (!atSpot) {
            a.act = "work";
            a.path = findPath(a, a.spot);
          } else if (r < 0.15) a.act = "drink";
          else if (r < 0.27) a.act = "phone";
          else if (r < 0.4) {
            a.act = "wander";
            a.path = findPath(a, randomTileIn(a.zone, () => rnd(a)));
          } else a.act = "work";
          a.actUntil = t + (a.act === "work" ? 7000 + rnd(a) * 8000 : 2500 + rnd(a) * 2000);
        }
      }
      // draw
      ctx.drawImage(bg, 0, 0);
      const dark = drawWindows(ctx, new Date(), t);
      const occupied = new Set<number>();
      const runners = new Map<number, number>();
      let scaleKg: number | null = null;
      for (const a of agents.current.values()) {
        const m = byId.get(a.id);
        if (!m || a.path.length) continue;
        if (a.rack >= 0) occupied.add(a.rack);
        if (a.zone === "cardio" && a.act === "work") {
          const i = SPOTS.cardio.findIndex((s) => s.x === a.spot.x && s.y === a.spot.y);
          if (i >= 0 && i < 3) runners.set(i, m.today && m.today.cardioMin ? (m.today.km / m.today.cardioMin) * 60 : 8);
        }
        if (a.zone === "bar" && Math.abs(a.x - SPOTS.bar[0].x) < 3 && Math.abs(a.y - SPOTS.bar[0].y) < 3) scaleKg = m.today?.bw ?? null;
      }
      if (scaleKg === null) scaleKg = v.members.find((m) => m.today?.bw)?.today?.bw ?? null;
      drawDynamic(ctx, t, occupied, runners, scaleKg);
      // wall of fame: weekly volume, per floor
      const fame = [...v.members]
        .filter((m) => m.weekly > 0)
        .sort((a, b) => b.weekly - a.weekly)
        .map((m) => ({ portrait: spriteCanvas({ params: m.params, look: m.look, sat: m.sat }), name: m.name, streak: m.streak, score: m.weekly }));
      drawFame(ctx, fame);
      for (const [text, x, y] of SIGNS) drawSign(ctx, text, x, y);

      const sorted = [...agents.current.values()].sort((a, b) => a.y - b.y);
      for (const a of sorted) {
        const m = byId.get(a.id);
        if (!m) continue;
        const today = m.today;
        const working = !a.path.length && a.act === "work" && WORK_ZONES.includes(a.zone);
        const sweat = today && working && wall - Date.parse(today.at) < 90 * 60000 ? Math.floor(t / 250) % 6 : undefined;
        const glow = !!today?.pr && wall - Date.parse(today.pr) < 15 * 60000 && Math.floor(t / 400) % 3 !== 0;
        const spr = spriteCanvas({ params: m.params, look: m.look, sat: m.sat, pose: poseFor(a, m, t + a.seed % 500), sweat, glow, grey: !today && m.planToday !== "" });
        ctx.drawImage(spr, Math.round(a.x - 16), Math.round(a.y - 46));
      }
      if (dark > 0) {
        ctx.fillStyle = `rgba(12,16,52,${dark})`;
        ctx.fillRect(0, 0, WW, WH);
      }
      const placed: [number, number, number][] = [];
      for (const a of [...sorted].reverse()) {
        const m = byId.get(a.id);
        if (!m) continue;
        const tag = tagFor(m);
        const w = textWidth(tag) + 4;
        const tx = Math.max(1, Math.min(WW - w - 1, Math.round(a.x - w / 2))); // never clipped by the floor edge
        // tags of lifters by the back wall go under their feet instead of over the windows
        const under = a.y - 54 < 50;
        let ty = Math.round(under ? a.y + 3 : a.y - 54);
        // nudge tags up until they stop overlapping ones already placed
        while (placed.some(([px, py, pw]) => tx < px + pw && px < tx + w && Math.abs(py - ty) < 10)) ty += under ? 10 : -10;
        placed.push([tx, ty, w]);
        ctx.fillStyle = a.id === meId ? "rgba(120,80,0,0.85)" : m.today || m.planToday === "" ? "rgba(25,18,12,0.72)" : "rgba(60,60,60,0.6)";
        ctx.fillRect(tx, ty, w, 9);
        drawText(ctx, tag, tx + 2, ty + 2, a.id === meId ? "#ffe9a8" : m.today || m.planToday === "" ? "#fff8e8" : "#cfcfcf");
        if (a.id === meId && !under) {
          // bobbing "YOU" marker so you can find yourself instantly
          const by = ty - 9 - (Math.floor(t / 300) % 2);
          ctx.fillStyle = "#2a1c16";
          ctx.fillRect(Math.round(a.x) - 9, by - 1, 19, 8);
          ctx.fillStyle = "#ffd23f";
          ctx.fillRect(Math.round(a.x) - 8, by, 17, 6);
          drawText(ctx, "YOU", Math.round(a.x) - 6, by + 1, "#2a1c16");
          ctx.fillRect(Math.round(a.x) - 1, by + 6, 3, 2);
        }
        if (a.emote && t < a.emote.until) drawEmote(ctx, a.emote.kind, a.emote.from, a.x, ty);
      }
      const wrap = wrapRef.current;
      if (wrap && !wrap.dataset.ready) wrap.dataset.ready = "1"; // hides the "Opening…" placeholder
      const mine = meId ? agents.current.get(meId) : undefined;
      if (wrap && mine && !followed.current && wrap.scrollWidth > wrap.clientWidth + 2) {
        followed.current = true;
        const sc = scaleRef.current;
        // center on where you're headed, not the door you spawn at
        wrap.scrollLeft = mine.spot.x * sc - wrap.clientWidth / 2;
        wrap.scrollTop = (mine.spot.y - 30) * sc - wrap.clientHeight / 2;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [meId]);


  const hitTest = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const wx = ((e.clientX - rect.left) * WW) / rect.width;
    const wy = ((e.clientY - rect.top) * WH) / rect.height;
    const hit = [...agents.current.values()]
      .sort((a, b) => b.y - a.y)
      .find((a) => Math.abs(wx - a.x) < 12 && wy > a.y - 56 && wy < a.y + 3);
    return hit && viewRef.current.members.find((x) => x.id === hit.id);
  };
  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const m = onSelect && hitTest(e);
    if (m) onSelect(m);
  };
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.currentTarget.style.cursor = onSelect && hitTest(e) ? "pointer" : "default";
  };

  return (
    <div className="floor">
      <div className="zoom">
        {(["fit", 1, 2, 3] as const).map((z) => (
          <button key={z} className={eff === z ? "on" : ""} onClick={() => setZoom(z)} aria-pressed={eff === z}>
            {z === "fit" ? "FIT" : `${z}X`}
          </button>
        ))}
      </div>
      <div className="floor-wrap" ref={wrapRef}>
        <p className="floor-loading" aria-hidden>Opening the gym floor…</p>
        <canvas
          ref={canvasRef}
          width={WW}
          height={WH}
          onClick={onClick}
          onMouseMove={onMove}
          style={{ width: WW * scale, height: WH * scale }}
          aria-label={`Pixel gym floor: ${view.name}`}
        />
      </div>
    </div>
  );
}

/** Apply a local emote immediately (demo floor or optimistic send). */
export function localEmote(view: FloorView, from: string, to: string, kind: EmoteKind): FloorView {
  return { ...view, emotes: [...view.emotes, { id: `${Date.now()}-${Math.random()}`, from, to, kind, at: new Date().toISOString() }] };
}
