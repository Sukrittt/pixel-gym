// The gym floor: a 40x24 tile map, hand-drawn pixel props, zones, BFS paths.
import type { Zone } from "./exercises";
import { drawText, textWidth } from "./font";

export const TILE = 16;
export const COLS = 40;
export const ROWS = 24;
export const WW = COLS * TILE;
export const WH = ROWS * TILE;

type T = "wall" | "side" | "wood" | "rubber" | "plat" | "cardio" | "tile" | "check" | "glass" | "door" | "walk" | "grass";
const map: T[][] = Array.from({ length: ROWS }, () => Array<T>(COLS).fill("wood"));
const fill = (t: T, x0: number, y0: number, x1: number, y1: number) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) map[y][x] = t;
};
fill("wall", 0, 0, 39, 2);
fill("side", 0, 3, 0, 19);
fill("side", 39, 3, 39, 19);
fill("rubber", 1, 3, 12, 10);
fill("rubber", 14, 3, 25, 10);
fill("cardio", 27, 3, 38, 9);
fill("tile", 1, 12, 12, 19);
fill("check", 27, 12, 38, 19);
fill("glass", 0, 20, 39, 20);
fill("door", 4, 20, 5, 20);
fill("walk", 0, 21, 39, 22);
fill("grass", 0, 23, 39, 23);
for (const x of [14, 17, 20, 23]) fill("plat", x, 4, x + 2, 8);

// ---- props ---------------------------------------------------------------
type PropKind =
  | "dbrack" | "bench" | "cable" | "rack" | "treadmill" | "bike" | "rower" | "lockers" | "lockersTop"
  | "lbench" | "cooler" | "mat" | "counter" | "shelf" | "stool" | "scale" | "table" | "plant" | "obench" | "tree" | "bush" | "kettle" | "roller";
type Prop = { k: PropKind; x: number; y: number; w: number; h: number; block?: boolean; color?: string };
export const PROPS: Prop[] = [
  { k: "dbrack", x: 1, y: 3, w: 9, h: 1, block: true },
  { k: "cable", x: 10, y: 3, w: 2, h: 2, block: true },
  { k: "bench", x: 2, y: 6, w: 2, h: 1, block: true },
  { k: "bench", x: 6, y: 6, w: 2, h: 1, block: true },
  { k: "bench", x: 2, y: 9, w: 2, h: 1, block: true },
  { k: "kettle", x: 10, y: 8, w: 2, h: 1, block: true },
  ...[14, 17, 20, 23].map((x) => ({ k: "rack" as const, x, y: 4, w: 3, h: 4 })),
  ...[28, 31, 34].map((x) => ({ k: "treadmill" as const, x, y: 3, w: 2, h: 3 })),
  { k: "bike", x: 37, y: 3, w: 2, h: 2, block: true },
  { k: "bike", x: 37, y: 6, w: 2, h: 2, block: true },
  { k: "rower", x: 28, y: 8, w: 3, h: 1, block: true },
  { k: "rower", x: 32, y: 8, w: 3, h: 1, block: true },
  { k: "lockersTop", x: 1, y: 12, w: 8, h: 1, block: true },
  { k: "lockers", x: 1, y: 13, w: 1, h: 6, block: true },
  { k: "lbench", x: 4, y: 15, w: 3, h: 1, block: true },
  { k: "cooler", x: 11, y: 12, w: 1, h: 1, block: true },
  { k: "plant", x: 12, y: 19, w: 1, h: 1, block: true },
  { k: "mat", x: 15, y: 13, w: 2, h: 3, color: "#3f7fbf" },
  { k: "mat", x: 18, y: 13, w: 2, h: 3, color: "#c0504d" },
  { k: "mat", x: 21, y: 13, w: 2, h: 3, color: "#5a9e5a" },
  { k: "mat", x: 15, y: 17, w: 2, h: 3, color: "#8e6bbf" },
  { k: "mat", x: 18, y: 17, w: 2, h: 3, color: "#d39b3a" },
  { k: "roller", x: 24, y: 13, w: 1, h: 2, block: true },
  { k: "shelf", x: 30, y: 12, w: 8, h: 1, block: true },
  { k: "counter", x: 30, y: 13, w: 8, h: 1, block: true },
  ...[31, 33, 35].map((x) => ({ k: "stool" as const, x, y: 14, w: 1, h: 1 })),
  { k: "scale", x: 28, y: 15, w: 1, h: 2 },
  { k: "table", x: 33, y: 17, w: 2, h: 1, block: true },
  { k: "table", x: 36, y: 17, w: 2, h: 1, block: true },
  { k: "plant", x: 38, y: 19, w: 1, h: 1, block: true },
  { k: "plant", x: 26, y: 3, w: 1, h: 1, block: true },
  { k: "plant", x: 13, y: 3, w: 1, h: 1, block: true },
  { k: "obench", x: 8, y: 22, w: 3, h: 1 },
  { k: "obench", x: 15, y: 22, w: 3, h: 1 },
  { k: "obench", x: 22, y: 22, w: 3, h: 1 },
  { k: "obench", x: 30, y: 22, w: 3, h: 1 },
  ...[1, 12, 19, 27, 35, 38].map((x) => ({ k: "tree" as const, x, y: 23, w: 1, h: 1 })),
  ...[3, 7, 14, 21, 25, 29, 33].map((x) => ({ k: "bush" as const, x, y: 23, w: 1, h: 1 })),
];

// ---- walkability + spots -------------------------------------------------
const BLOCKED = new Set<T>(["wall", "side", "glass", "grass"]);
export const walkable: boolean[][] = map.map((row) => row.map((t) => !BLOCKED.has(t)));
for (const p of PROPS) if (p.block) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) walkable[y][x] = false;
for (const x of [14, 17, 20, 23]) for (let y = 4; y <= 7; y++) walkable[y][x] = walkable[y][x + 2] = false; // rack posts
for (const x of [28, 31, 34]) walkable[3][x] = walkable[3][x + 1] = false; // treadmill consoles

export type Pt = { x: number; y: number };
const at = (tx: number, ty: number, dx = 8, dy = 12): Pt => ({ x: tx * TILE + dx, y: ty * TILE + dy });

export const SPOTS: Record<Zone, Pt[]> = {
  weights: [at(4, 6), at(8, 6), at(4, 9), at(8, 9), at(11, 6), at(6, 8), at(10, 10), at(2, 8)],
  squat: [15, 18, 21, 24].map((x) => at(x, 7)),
  cardio: [at(28, 5, 16), at(31, 5, 16), at(34, 5, 16), at(30, 9), at(36, 9), at(37, 9)],
  mat: [at(15, 15, 16), at(18, 15, 16), at(21, 15, 16), at(15, 18, 16), at(18, 18, 16), at(23, 17), at(22, 19)],
  bar: [at(28, 16), at(31, 15), at(33, 15), at(35, 15), at(32, 18), at(36, 18)],
  lockers: [at(3, 17), at(6, 17), at(8, 16), at(10, 17), at(11, 16), at(3, 19)],
  outside: [8, 9, 10, 15, 16, 17, 22, 23, 24, 30, 31, 32].map((x) => at(x, 22, 8, 10)),
};
export const SPAWN: Pt = at(4, 19);
export const ZONE_RECT: Record<Zone, [number, number, number, number]> = {
  weights: [1, 4, 12, 10], squat: [14, 8, 25, 10], cardio: [27, 6, 38, 9], mat: [14, 12, 25, 19],
  bar: [27, 14, 38, 19], lockers: [2, 13, 12, 19], outside: [1, 21, 38, 22],
};

export const tileOf = (p: Pt): Pt => ({ x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) });

/** BFS over the tile grid; returns pixel waypoints ending exactly at `to`. */
export function findPath(from: Pt, to: Pt): Pt[] {
  const s = tileOf(from), g = tileOf(to);
  const key = (x: number, y: number) => y * COLS + x;
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const q = [key(s.x, s.y)];
  prev[q[0]] = q[0];
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS && (walkable[y][x] || (x === g.x && y === g.y));
  while (q.length) {
    const k = q.shift()!;
    const x = k % COLS, y = (k / COLS) | 0;
    if (x === g.x && y === g.y) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (ok(nx, ny) && prev[key(nx, ny)] < 0) {
        prev[key(nx, ny)] = k;
        q.push(key(nx, ny));
      }
    }
  }
  if (prev[key(g.x, g.y)] < 0) return [to];
  const out: Pt[] = [to];
  for (let k = prev[key(g.x, g.y)]; k !== key(s.x, s.y); k = prev[k]) out.push(at(k % COLS, (k / COLS) | 0, 8, 10));
  return out.reverse();
}

export function randomTileIn(zone: Zone, rnd: () => number): Pt {
  const [x0, y0, x1, y1] = ZONE_RECT[zone];
  for (let i = 0; i < 30; i++) {
    const x = x0 + Math.floor(rnd() * (x1 - x0 + 1)), y = y0 + Math.floor(rnd() * (y1 - y0 + 1));
    if (walkable[y]?.[x]) return at(x, y, 8, 10);
  }
  return SPOTS[zone][0];
}

// ---- drawing -------------------------------------------------------------
type Ctx = CanvasRenderingContext2D;
let R: (x: number, y: number, w: number, h: number, c: string) => void;
const bind = (ctx: Ctx) => {
  R = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
};
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawTile(t: T, tx: number, ty: number, r: () => number) {
  const x = tx * TILE, y = ty * TILE;
  switch (t) {
    case "wood": {
      const tones = ["#c99a5e", "#c39158", "#cfa266", "#bf8d55"];
      for (let i = 0; i < 4; i++) {
        R(x, y + i * 4, 16, 4, tones[(tx * 3 + ty * 4 + i * 7) % 4]);
        R(x, y + i * 4 + 3, 16, 1, "#a87a45");
        const seam = (tx * 5 + i * 9 + ty * 3) % 16;
        if ((tx + i + ty) % 3 === 0) R(x + seam, y + i * 4, 1, 3, "#a87a45");
      }
      if (r() < 0.2) R(x + Math.floor(r() * 14), y + Math.floor(r() * 14), 2, 1, "#b5844d");
      break;
    }
    case "rubber":
      R(x, y, 16, 16, "#3b4047");
      for (let i = 0; i < 6; i++) R(x + Math.floor(r() * 16), y + Math.floor(r() * 16), 1, 1, r() < 0.5 ? "#4a5059" : "#30343a");
      R(x, y + 15, 16, 1, "#33383e");
      R(x + 15, y, 1, 16, "#33383e");
      break;
    case "plat":
      R(x, y, 16, 16, "#d6ab70");
      R(x, y + 7, 16, 1, "#b88d55");
      R(x, y + 15, 16, 1, "#b88d55");
      if (r() < 0.3) R(x + 3, y + 3, 3, 1, "#c99d62");
      break;
    case "cardio":
      R(x, y, 16, 16, "#6c737d");
      R(x, y, 16, 1, "#757d88");
      R(x, y, 1, 16, "#757d88");
      if (r() < 0.4) R(x + Math.floor(r() * 14), y + Math.floor(r() * 14), 1, 1, "#616872");
      break;
    case "tile":
      R(x, y, 16, 16, "#c3c7cc");
      R(x, y, 8, 8, "#cdd1d6");
      R(x + 8, y + 8, 8, 8, "#cdd1d6");
      R(x, y + 15, 16, 1, "#aeb3b9");
      R(x + 15, y, 1, 16, "#aeb3b9");
      break;
    case "check":
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) R(x + i * 4, y + j * 4, 4, 4, (i + j + tx + ty) % 2 ? "#e9dcc2" : "#c46a4a");
      break;
    case "wall":
      if (ty === 0) {
        R(x, y, 16, 16, "#efe1c4");
        R(x, y, 16, 3, "#6b4a35");
        R(x, y + 3, 16, 1, "#8a6448");
      } else if (ty === 1) R(x, y, 16, 16, "#efe1c4");
      else {
        R(x, y, 16, 16, "#9b6b45");
        R(x, y, 16, 2, "#7a5235");
        R(x + (tx % 2 ? 0 : 8), y + 2, 1, 14, "#8a5f3d");
        R(x, y + 15, 16, 1, "#5d3f2a");
      }
      break;
    case "side":
      R(x, y, 16, 16, "#7a5235");
      R(tx === 0 ? x + 12 : x, y, 4, 16, "#5d3f2a");
      if (ty % 2) R(x, y + 8, 16, 1, "#6b4830");
      break;
    case "glass":
      R(x, y, 16, 16, "#9fd0e0");
      R(x, y, 16, 2, "#5b6670");
      R(x, y + 14, 16, 2, "#5b6670");
      R(x + 2, y + 4, 2, 6, "#d6f0f7");
      R(x + 5, y + 3, 1, 3, "#d6f0f7");
      if (tx % 3 === 0) R(x, y, 2, 16, "#5b6670");
      break;
    case "door":
      R(x, y, 16, 16, "#b8e0ec");
      R(x, y, 16, 2, "#4a545c");
      R(x, y + 14, 16, 2, "#c9b48a");
      R(tx === 4 ? x + 13 : x + 1, y + 6, 2, 4, "#e6c35c");
      break;
    case "walk":
      R(x, y, 16, 16, "#b9b0a2");
      R(x, y, 16, 1, "#a69d8f");
      R(x, y, 1, 16, "#a69d8f");
      if (r() < 0.3) R(x + Math.floor(r() * 14), y + Math.floor(r() * 14), 1, 1, "#a69d8f");
      break;
    case "grass":
      R(x, y, 16, 16, "#69a84a");
      for (let i = 0; i < 8; i++) R(x + Math.floor(r() * 15), y + Math.floor(r() * 14), 1, 2, r() < 0.5 ? "#7cbf57" : "#5a9440");
      if (r() < 0.25) R(x + Math.floor(r() * 13), y + Math.floor(r() * 13), 2, 2, r() < 0.5 ? "#f2d14b" : "#e86a6a");
      break;
  }
}

function drawProp(p: Prop) {
  const x = p.x * TILE, y = p.y * TILE, w = p.w * TILE, h = p.h * TILE;
  switch (p.k) {
    case "dbrack": {
      R(x, y + 2, w, 13, "#2b2f35");
      R(x, y + 2, w, 1, "#4d535c");
      R(x, y + 8, w, 1, "#4d535c");
      const cols = ["#c0392b", "#2f6fb5", "#e0a32a", "#2fa36b", "#7d4fb0", "#555"];
      for (let i = 0; i < w / 8 - 0.5; i++) {
        const c = cols[i % cols.length];
        for (const row of [3, 9]) {
          R(x + 2 + i * 8, y + row + 1, 5, 1, "#a9b1ba");
          R(x + 1 + i * 8, y + row, 2, 4, c);
          R(x + 6 + i * 8, y + row, 2, 4, c);
        }
      }
      R(x, y + 15, w, 1, "#1d2025");
      break;
    }
    case "cable":
      R(x + 2, y, 3, h, "#8f99a3");
      R(x + w - 5, y, 3, h, "#8f99a3");
      R(x + 2, y, w - 4, 3, "#6b737c");
      R(x + 10, y + 4, 12, 18, "#2b2f35");
      for (let i = 0; i < 6; i++) R(x + 11, y + 5 + i * 3, 10, 2, "#555c66");
      R(x + 15, y + 3, 1, 24, "#d0d0d0");
      break;
    case "bench":
      R(x + 3, y + 10, 2, 5, "#7c858f");
      R(x + w - 5, y + 10, 2, 5, "#7c858f");
      R(x + 1, y + 4, w - 2, 7, "#1f2226");
      R(x + 2, y + 4, w - 4, 2, "#3a3f46");
      R(x + 1, y + 11, w - 2, 1, "#111");
      break;
    case "kettle":
      for (let i = 0; i < 4; i++) {
        const c = ["#2b2f35", "#c0392b", "#2f6fb5", "#e0a32a"][i];
        R(x + 2 + i * 7, y + 6, 6, 6, c);
        R(x + 3 + i * 7, y + 3, 4, 1, c);
        R(x + 3 + i * 7, y + 3, 1, 3, c);
        R(x + 6 + i * 7, y + 3, 1, 3, c);
        R(x + 3 + i * 7, y + 7, 1, 1, "#ffffff55");
      }
      break;
    case "rack":
      // posts are drawn here; bars are dynamic (only on empty racks)
      for (const px of [x + 4, x + w - 8]) {
        R(px, y - 6, 4, h + 6, "#9aa4ae");
        R(px, y - 6, 1, h + 6, "#c9d1d8");
        R(px + 3, y - 6, 1, h + 6, "#6b747d");
        for (let i = 0; i < 8; i++) R(px + 1, y - 2 + i * 7, 2, 1, "#4f575f");
      }
      R(x + 4, y - 6, w - 8, 3, "#8a939c");
      R(x + 1, y + h - 2, w - 2, 3, "#59616a");
      break;
    case "treadmill":
      R(x + 3, y + 14, w - 6, h - 16, "#25282d");
      R(x + 5, y + 16, w - 10, h - 20, "#3a3e44");
      R(x + 2, y, 3, 18, "#8f99a3");
      R(x + w - 5, y, 3, 18, "#8f99a3");
      R(x + 4, y + 2, w - 8, 7, "#2b2f35");
      R(x + 8, y + 3, w - 16, 4, "#3fbf6f");
      break;
    case "bike":
      R(x + 6, y + 14, w - 12, 6, "#2b2f35");
      R(x + 14, y + 6, 4, 10, "#9aa4ae");
      R(x + 10, y + 4, 12, 3, "#1f2226");
      R(x + 6, y + 20, w - 12, 4, "#c0392b");
      R(x + 4, y + 26, w - 8, 3, "#59616a");
      break;
    case "rower":
      R(x + 2, y + 8, w - 4, 3, "#9aa4ae");
      R(x + w - 12, y + 2, 10, 12, "#2b2f35");
      R(x + w - 10, y + 4, 6, 6, "#3fbf6f55");
      R(x + 10, y + 5, 8, 5, "#1f2226");
      R(x + 2, y + 12, w - 4, 2, "#59616a");
      break;
    case "lockersTop":
    case "lockers": {
      const vertical = p.k === "lockers";
      const n = vertical ? p.h : p.w;
      for (let i = 0; i < n; i++) {
        const lx = vertical ? x : x + i * 16, ly = vertical ? y + i * 16 : y - 8;
        const lh = vertical ? 16 : 24;
        R(lx, ly, 16, lh, "#5e7fa0");
        R(lx + 1, ly + 1, 14, lh - 2, "#6f93b6");
        R(lx + 3, ly + 3, 10, 1, "#4b6784");
        R(lx + 3, ly + 5, 10, 1, "#4b6784");
        R(lx + 11, ly + lh / 2, 2, 3, "#d8dde2");
        R(lx + 15, ly, 1, lh, "#3d556d");
      }
      break;
    }
    case "lbench":
      R(x + 2, y + 6, w - 4, 4, "#b07a46");
      R(x + 2, y + 6, w - 4, 1, "#d39b62");
      R(x + 4, y + 10, 2, 5, "#5d3f2a");
      R(x + w - 6, y + 10, 2, 5, "#5d3f2a");
      break;
    case "cooler":
      R(x + 3, y + 6, 10, 10, "#e6e9ec");
      R(x + 4, y - 4, 8, 10, "#7cc4ef");
      R(x + 5, y - 3, 2, 6, "#b9e3fa");
      R(x + 6, y + 9, 4, 2, "#3b7dd8");
      break;
    case "plant":
      R(x + 4, y + 9, 8, 7, "#b5653a");
      R(x + 4, y + 9, 8, 1, "#d27d4e");
      R(x + 2, y + 1, 12, 9, "#3f8f3f");
      R(x + 5, y - 3, 6, 6, "#4fa64a");
      R(x + 4, y + 3, 2, 2, "#6cc35f");
      break;
    case "roller":
      R(x + 4, y + 2, 8, 28, "#2b2f35");
      for (let i = 0; i < 4; i++) R(x + 5, y + 4 + i * 7, 6, 3, ["#3f7fbf", "#c0504d", "#5a9e5a", "#d39b3a"][i]);
      break;
    case "mat":
      R(x + 2, y + 1, w - 4, h - 2, p.color!);
      R(x + 2, y + 1, w - 4, 2, "#ffffff40");
      R(x + 2, y + h - 3, w - 4, 2, "#00000030");
      break;
    case "shelf":
      R(x, y - 10, w, 22, "#7a5235");
      R(x, y - 10, w, 2, "#5d3f2a");
      for (let i = 0; i < w / 6 - 1; i++) {
        const c = ["#f2c14e", "#e86a6a", "#8bd17c", "#b48ef0", "#f29f4e"][i % 5];
        R(x + 3 + i * 6, y - 6, 4, 6, c);
        R(x + 3 + i * 6, y + 3, 4, 6, ["#ffffff", "#f2c14e", "#e86a6a"][i % 3]);
      }
      R(x, y + 1, w, 1, "#5d3f2a");
      break;
    case "counter":
      R(x, y + 2, w, 14, "#8a5a32");
      R(x, y + 2, w, 3, "#c98d5a");
      R(x + 10, y - 4, 6, 7, "#d9e7ef");
      R(x + 11, y - 1, 4, 4, "#e86a8a");
      R(x + 40, y - 3, 4, 6, "#f2c14e");
      R(x + 60, y - 3, 4, 6, "#8bd17c");
      R(x + 90, y - 6, 8, 9, "#3a3f46");
      break;
    case "stool":
      R(x + 4, y + 2, 8, 3, "#c0392b");
      R(x + 7, y + 5, 2, 9, "#7c858f");
      R(x + 5, y + 13, 6, 2, "#59616a");
      break;
    case "scale":
      R(x + 2, y + 18, 12, 10, "#d8dde2");
      R(x + 3, y + 19, 10, 8, "#eef1f4");
      R(x + 6, y + 2, 4, 17, "#9aa4ae");
      R(x - 2, y - 6, 20, 10, "#2b2f35"); // LCD housing, digits drawn live
      break;
    case "table":
      R(x + 2, y + 2, w - 4, 8, "#c98d5a");
      R(x + 2, y + 2, w - 4, 2, "#e0aa74");
      R(x + 14, y + 10, 4, 6, "#5d3f2a");
      R(x + 6, y + 0, 3, 4, "#8bd17c");
      break;
    case "obench":
      R(x + 2, y + 4, w - 4, 3, "#a86a3a");
      R(x + 2, y + 8, w - 4, 3, "#c4844e");
      R(x + 4, y + 11, 2, 5, "#3a2a20");
      R(x + w - 6, y + 11, 2, 5, "#3a2a20");
      break;
    case "tree":
      R(x + 6, y + 6, 4, 10, "#6b4a2b");
      R(x - 2, y - 14, 20, 16, "#3f8a3a");
      R(x + 1, y - 18, 14, 6, "#4fa64a");
      R(x + 2, y - 12, 4, 3, "#6cc35f");
      R(x - 2, y, 20, 2, "#2f6e2c");
      break;
    case "bush":
      R(x + 1, y + 4, 14, 10, "#3f8a3a");
      R(x + 3, y + 2, 10, 4, "#4fa64a");
      R(x + 4, y + 5, 2, 2, "#e86a6a");
      R(x + 10, y + 7, 2, 2, "#f2d14b");
      break;
  }
}

/** Static background: tiles + props. Drawn once into an offscreen canvas. */
export function drawBackground(ctx: Ctx) {
  bind(ctx);
  const r = rng(7);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawTile(map[y][x], x, y, r);
  // zone floor borders (painted lines)
  R(1 * TILE, 11 * TILE - 1, 12 * TILE, 1, "#e9d38a");
  for (const p of PROPS) drawProp(p);
}

export const WINDOWS = [2, 6, 27, 31, 35];

function sky(hour: number): { top: string; bot: string; night: boolean } {
  if (hour < 5 || hour >= 21) return { top: "#0d1433", bot: "#243063", night: true };
  if (hour < 7) return { top: "#4a4e8f", bot: "#f2a35e", night: false };
  if (hour < 17) return { top: "#5fb3f0", bot: "#bfe6ff", night: false };
  if (hour < 19) return { top: "#7b5ea7", bot: "#f6a05a", night: false };
  return { top: "#2b2d63", bot: "#8a4f7d", night: true };
}

/** Windows show real-clock sky; returns how dark the room should be (0..1). */
export function drawWindows(ctx: Ctx, date: Date, t: number): number {
  bind(ctx);
  const h = date.getHours() + date.getMinutes() / 60;
  const s = sky(h);
  for (const wx of WINDOWS) {
    const x = wx * TILE, y = 4;
    R(x - 2, y - 2, 36, 26, "#6b4a35");
    R(x, y, 32, 11, s.top);
    R(x, y + 11, 32, 11, s.bot);
    if (s.night) {
      for (let i = 0; i < 5; i++) R(x + ((i * 13 + wx * 7) % 30) + 1, y + ((i * 7 + wx) % 9) + 1, 1, 1, (t / 600 + i) % 3 < 2 ? "#ffffff" : "#8899cc");
      if (wx === 27) {
        R(x + 22, y + 3, 5, 5, "#f4f1c9");
        R(x + 24, y + 3, 3, 3, s.top);
      }
    } else {
      const cx = (x + ((t / 120 + wx * 11) % 40)) | 0;
      R(Math.min(cx, x + 26), y + 5, 6, 2, "#ffffffcc");
      if (wx === 31 && h >= 7 && h < 17) R(x + 4, y + 3, 4, 4, "#ffe680");
    }
    R(x + 15, y, 2, 22, "#6b4a35");
    R(x, y + 10, 32, 1, "#6b4a35");
  }
  return s.night ? 0.28 : h < 7 || h >= 17 ? 0.12 : 0;
}

export function drawSign(ctx: Ctx, text: string, cx: number, y: number) {
  bind(ctx);
  const w = textWidth(text) + 8;
  const x = Math.round(cx - w / 2);
  R(x + 2, y + 9, 2, 5, "#5d3f2a");
  R(x + w - 4, y + 9, 2, 5, "#5d3f2a");
  R(x - 1, y - 1, w + 2, 11, "#3a2618");
  R(x, y, w, 9, "#b97a3e");
  R(x, y, w, 1, "#d99a5a");
  R(x, y + 8, w, 1, "#8a5528");
  drawText(ctx, text, x + 4, y + 2, "#fff4d6");
}

export const SIGNS: [string, number, number][] = [
  ["FREE WEIGHTS", 6.5 * TILE, 10 * TILE + 3],
  ["SQUAT RACKS", 20 * TILE, 9 * TILE + 3],
  ["CARDIO", 33 * TILE, 10 * TILE - 13],
  ["MATS", 20 * TILE, 11 * TILE + 3],
  ["SMOOTHIE BAR", 33 * TILE, 11 * TILE - 6],
  ["LOCKERS", 6.5 * TILE, 11 * TILE + 3],
];

/** Rack barbells, treadmill belts, scale LCD: things that change per frame. */
export function drawDynamic(ctx: Ctx, t: number, occupiedRacks: Set<number>, runners: Map<number, number>, scaleKg: number | null) {
  bind(ctx);
  [14, 17, 20, 23].forEach((x, i) => {
    if (occupiedRacks.has(i)) return;
    const px = x * TILE;
    R(px - 2, 4 * TILE + 8, 3 * TILE + 4, 2, "#c9d1d8");
    for (const ex of [px - 3, px + 3 * TILE - 1]) R(ex, 4 * TILE + 3, 4, 12, "#2b2f35");
  });
  [28, 31, 34].forEach((x, i) => {
    const speed = runners.get(i);
    const px = x * TILE + 5, py = 3 * TILE + 17;
    const off = speed ? Math.floor(t / (1000 / (speed * 2))) % 4 : 0;
    for (let k = 0; k < 7; k++) R(px + 1, py + 2 + ((k * 4 + off) % 26), 20, 1, "#2a2d32");
  });
  const lx = 28 * TILE - 2, ly = 15 * TILE - 6;
  R(lx + 2, ly + 2, 16, 6, scaleKg ? "#9fe27a" : "#3f5a34");
  if (scaleKg) {
    const s = scaleKg.toFixed(1).slice(-5);
    drawText(ctx, s, lx + 10 - textWidth(s) / 2, ly + 2, "#1f3a12");
  }
}

/** Wall of fame: framed pixel portraits, frame color by streak. */
export type FameEntry = { portrait: CanvasImageSource; name: string; streak: number; score: number };
export function drawFame(ctx: Ctx, entries: FameEntry[]) {
  bind(ctx);
  const x0 = 13 * TILE + 4, y0 = 2;
  const w = 13 * TILE - 8;
  R(x0, y0, w, 44, "#5d3f2a");
  R(x0 + 2, y0 + 2, w - 4, 40, "#3a2618");
  drawText(ctx, "WALL OF FAME", x0 + w / 2 - textWidth("WALL OF FAME") / 2, y0 + 4, "#ffd23f");
  if (!entries.length) {
    const msg = "LOG A WORKOUT TO GET ON THE WALL";
    drawText(ctx, msg, x0 + w / 2 - textWidth(msg) / 2, y0 + 22, "#ffffff");
  }
  entries.slice(0, 7).forEach((e, i) => {
    const fx = x0 + 8 + i * 28, fy = y0 + 13;
    const frame = e.streak >= 10 ? "#ffd23f" : e.streak >= 5 ? "#cfd8e0" : e.streak >= 2 ? "#cd7f32" : "#8a6448";
    R(fx - 2, fy - 2, 22, 24, frame);
    R(fx - 1, fy - 1, 20, 22, "#00000040");
    R(fx, fy, 18, 20, "#e8d9b5");
    ctx.drawImage(e.portrait, 7, 1, 18, 20, fx, fy, 18, 20);
    if (e.streak >= 10) R(fx + 17, fy - 3, 2, 2, "#ffffff");
    R(fx, fy + 13, 5, 7, "#2a1c16");
    drawText(ctx, String(i + 1), fx + 1, fy + 14, "#ffd23f");
    drawText(ctx, e.name.slice(0, 5), fx + 4, fy + 22, "#f3e6c8");
  });
}
