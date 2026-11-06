// Procedural 32x48 avatar. Every body part is its own layer, sized from its
// param by interpolating between 3 keyframes (small / mid / big), then layers
// are outlined and stacked. No fixed sprite stages anywhere.
import type { Params } from "./body";

export const SW = 32;
export const SH = 48;

export type Look = { skin: number; hair: number; hairColor: number; shirt: number; shorts: number };
export type ArmPose = "down" | "swingF" | "swingB" | "curl" | "up" | "hold" | "bar";
export type LegPose = "stand" | "stepA" | "stepB" | "squat" | "sit";
export type Prop = "dumbbell" | "barbell" | "bottle" | "phone";
export type Pose = { legs: LegPose; arms: [ArmPose, ArmPose]; prop?: Prop; propHand?: 0 | 1 | 2; lookDown?: boolean; bounce?: number };
export type SpriteOpts = {
  params: Params;
  look: Look;
  sat?: number; // skin saturation multiplier (consistency)
  pose?: Pose;
  sweat?: number; // frame index when sweating
  glow?: boolean; // post-PR
  grey?: boolean; // no log today
};

export const STAND: Pose = { legs: "stand", arms: ["down", "down"] };

// ---- palette ---------------------------------------------------------------
export const SKINS = ["#f6cfa6", "#e8b088", "#c98d5e", "#9a6440", "#6b4128"];
export const HAIRS = ["#2a1b12", "#5b3a1f", "#a3682c", "#e2bf68", "#b8402f", "#8d8d94"];
export const SHIRTS = ["#d9534f", "#3b7dd8", "#2fa36b", "#f0a63c", "#8e5bd8", "#e9e4d8", "#38404d"];
export const SHORTS = ["#2c3e50", "#1e2630", "#5a4632", "#3d5a80", "#6b2d3a"];
const OUTLINE = "#2a1c16";
const GLOW = "#ffd23f";

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const pack = ([r, g, b]: RGB, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
const mul = ([r, g, b]: RGB, f: number): RGB => [r * f, g * f, b * f].map((v) => Math.max(0, Math.min(255, Math.round(v)))) as RGB;
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;

function saturate([r, g, b]: RGB, s: number): RGB {
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(l + (v - l) * s)))) as RGB;
}

type Tone = { base: number; hi: number; sh: number; deep: number };
function tone(c: RGB): Tone {
  return { base: pack(c), hi: pack(mix(c, [255, 240, 220], 0.28)), sh: pack(mul(c, 0.8)), deep: pack(mul(c, 0.64)) };
}

// ---- keyframe interpolation ------------------------------------------------
/** Interpolate between small/mid/big keyframes for p in 0..10. */
export function kf(p: number, k: [number, number, number]): number {
  const t = Math.max(0, Math.min(10, p)) / 5;
  return t <= 1 ? k[0] + (k[1] - k[0]) * t : k[1] + (k[2] - k[1]) * (t - 1);
}
const kfRow = (p: number, k: [number[], number[], number[]]) => k[0].map((_, i) => Math.round(kf(p, [k[0][i], k[1][i], k[2][i]])));

// ---- layers ----------------------------------------------------------------
type Layer = Uint32Array;
const layer = (): Layer => new Uint32Array(SW * SH);
const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < SW && y < SH;
const set = (l: Layer, x: number, y: number, c: number) => {
  if (inb(x, y)) l[y * SW + x] = c;
};
const get = (l: Layer, x: number, y: number) => (inb(x, y) ? l[y * SW + x] : 0);
const hspan = (l: Layer, y: number, x0: number, x1: number, c: number) => {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(l, x, y, c);
};
/** Symmetric span around the sprite's center line (between x=15 and x=16). */
const sym = (l: Layer, y: number, half: number, c: number) => hspan(l, y, 16 - half, 15 + half, c);
/** Draw f for the left side, and mirrored for the right. */
const both = (f: (mx: (x: number) => number, side: 0 | 1) => void) => {
  f((x) => x, 0);
  f((x) => 31 - x, 1);
};

/** Light from the upper-left: left edges highlight, right/bottom edges shade. */
function shade(l: Layer, t: Tone) {
  const src = l.slice();
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      if (src[y * SW + x] !== t.base) continue;
      if (!get(src, x - 1, y)) l[y * SW + x] = t.hi;
      else if (!get(src, x + 1, y) || !get(src, x, y + 1)) l[y * SW + x] = t.sh;
    }
}

/** Stamp a layer onto dst with a 1px outline that also cuts over lower layers. */
function stamp(dst: Layer, src: Layer, outline: number, dy = 0) {
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      if (src[y * SW + x]) continue;
      if (get(src, x - 1, y) || get(src, x + 1, y) || get(src, x, y - 1) || get(src, x, y + 1)) set(dst, x, y + dy, outline);
    }
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (src[y * SW + x]) set(dst, x, y + dy, src[y * SW + x]);
}

/** Recolor a skin-shaded mask into cloth so muscle contours show through tight fabric. */
function clothFrom(skinLayer: Layer, mask: (x: number, y: number) => boolean, s: Tone, c: Tone): Layer {
  const out = layer();
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const v = skinLayer[y * SW + x];
      if (!v || !mask(x, y)) continue;
      out[y * SW + x] = v === s.deep ? c.deep : v === s.sh ? c.sh : v === s.hi ? c.hi : c.base;
    }
  return out;
}

const disc = (l: Layer, cx: number, cy: number, r: number, c: number) => {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) set(l, x, y, c);
};

// ---- the body --------------------------------------------------------------
export function strength(p: Params) {
  return (p.shoulders + p.chest + p.back + p.arms + p.legs) / 5;
}

export type ShirtFit = "loose" | "tight" | "tank";
export function shirtFit(p: Params): ShirtFit {
  const m = Math.max(p.chest, p.shoulders);
  return m > 8 ? "tank" : m > 6 ? "tight" : "loose";
}

export function composeSprite(o: SpriteOpts): Uint32Array {
  const p = o.params;
  const pose = o.pose ?? STAND;
  const L = o.look;
  const skinRGB = saturate(hex(SKINS[L.skin % SKINS.length]), o.sat ?? 1);
  const S = tone(skinRGB);
  const shirtT = tone(hex(SHIRTS[L.shirt % SHIRTS.length]));
  const shortsT = tone(hex(SHORTS[L.shorts % SHORTS.length]));
  const hairT = tone(hex(HAIRS[L.hairColor % HAIRS.length]));
  const outline = pack(hex(o.glow ? GLOW : OUTLINE));
  const bf = p.bodyfat;
  const str = strength(p);
  const fit = shirtFit(p);

  // vertical layout
  const thighRows = pose.legs === "squat" ? 3 : pose.legs === "sit" ? 2 : 6;
  const drop = 6 - thighRows; // how far the hips sink
  const posture = str < 3 ? 1 : str > 6.5 ? -1 : 0; // slouch 1px / stand tall
  const upDy = drop + posture + (pose.bounce ?? 0);

  // ---- torso half-widths, rows 15..29 (upper / lats / waist channels)
  const upper = kfRow((p.chest + p.back) / 2, [[4, 5, 5, 5, 5], [5, 6, 6, 6, 6], [6, 8, 8, 8, 8]]);
  const lats = kfRow(p.back, [[5, 4, 4, 4, 4], [6, 6, 5, 5, 5], [8, 8, 7, 6, 5]]);
  const fat = kfRow(bf, [[4, 4, 4, 4, 4, 4, 4, 4, 4, 4], [5, 5, 5, 5, 5, 5, 5, 5, 5, 5], [6, 6, 7, 7, 8, 8, 8, 8, 7, 7]]);
  const torsoHalf = (row: number) => {
    if (row < 5) return upper[row] + (bf > 7.5 && row > 1 ? 1 : 0);
    if (row < 10) return Math.max(lats[row - 5], fat[row - 5]);
    return fat[row - 5];
  };
  const T = 15;
  const halves = Array.from({ length: 15 }, (_, r) => torsoHalf(r));
  const maxHalf = Math.max(...halves.slice(1, 10));

  const torso = layer();
  for (let r = 0; r < 15; r++) sym(torso, T + r, halves[r], S.base);
  // neck + traps
  const trap = kfRow((p.shoulders + p.back) / 2, [[2, 3], [3, 5], [4, 7]]);
  sym(torso, 12, bf > 8 ? 3 : 2, S.base);
  sym(torso, 13, trap[0], S.base);
  sym(torso, 14, Math.max(trap[1], halves[0] - 1), S.base);
  shade(torso, S);
  // pecs
  const pecY = T + 4 + Math.round(p.chest / 5);
  if (p.chest > 2 || bf > 6) {
    const c = p.chest > 5 && bf < 7 ? S.deep : S.sh;
    for (let dx = 1; dx <= halves[3] - 2; dx++) both((m) => set(torso, m(16 - dx), pecY - (dx === halves[3] - 2 ? 1 : 0), c));
    if (p.chest > 4) for (let y = pecY - 2; y < pecY; y++) both((m) => set(torso, m(15), y, S.sh));
    if (p.chest > 3 && bf < 7) both((m) => hspan(torso, pecY - 2, m(13), m(14), S.hi));
  }
  // abs / belly by bodyfat
  if (bf < 5.5) {
    for (let y = pecY + 2; y <= 27; y++) both((m) => set(torso, m(15), y, bf < 2.5 ? S.deep : S.sh));
    if (bf < 4)
      for (const y of bf < 2.5 ? [22, 24, 26] : [23, 25]) if (y > pecY + 1) both((m) => hspan(torso, y, m(13), m(14), bf < 2.5 ? S.deep : S.sh));
  }
  if (bf >= 4) both((m) => set(torso, m(15), 27, S.deep));
  if (bf > 6) {
    both((m) => hspan(torso, 24, m(13), m(15), S.hi));
    both((m) => hspan(torso, 29, m(12), m(15), S.sh));
  }
  // lats + serratus
  if (p.back > 3)
    for (let r = 5; r < 10; r++) both((m) => set(torso, m(16 - halves[r] + 1), T + r, p.back > 6 ? S.deep : S.sh));
  if (p.back > 7 && bf < 4) for (const y of [21, 23]) both((m) => set(torso, m(16 - halves[y - T] + 2), y, S.sh));
  if (p.shoulders + p.back > 10) both((m) => set(torso, m(16 - trap[1] + 1), 14, S.hi));

  // ---- delts
  const r = kf(p.shoulders, [1.6, 2.5, 3.6]);
  const deltL = layer();
  const deltCx = 16 - halves[1] + r * 0.25;
  const deltCy = 16.6;
  disc(deltL, deltCx, deltCy, r, S.base);
  disc(deltL, 32 - deltCx, deltCy, r, S.base);
  shade(deltL, S);
  if (p.shoulders > 6) both((m) => set(deltL, m(Math.round(deltCx)), Math.round(deltCy + r * 0.5), S.deep));

  // ---- arms
  const upperW = kfRow(p.arms, [[2, 2, 2, 2, 2, 2, 2], [3, 3, 4, 4, 3, 3, 3], [4, 5, 6, 6, 5, 4, 4]]).map((w) => w + (bf > 6.5 ? 1 : 0));
  const foreW = kfRow(p.arms * 0.9, [[2, 2, 2, 2, 2, 2], [3, 3, 3, 3, 2, 2], [4, 4, 4, 3, 3, 3]]);
  const handW = p.arms > 6 ? 3 : 2;
  const armInner = 14 - maxHalf; // 1px gap from the widest torso row
  const armC = armInner - 1;
  const arms: Layer[] = [];
  const hands: { x: number; y: number }[] = [];
  both((m, side) => {
    const a = layer();
    const ap = pose.arms[side];
    const sw = ap === "swingF" ? 1 : ap === "swingB" ? -1 : 0;
    const col = (y: number, w: number, c: number, cx = armC) => hspan(a, y, m(cx - Math.floor((w - 1) / 2)), m(cx + Math.ceil((w - 1) / 2)), c);
    if (ap === "up") {
      const cx = Math.round(deltCx) - 1;
      for (let i = 0; i < 7; i++) col(15 - i, upperW[6 - i], S.base, cx);
      for (let i = 0; i < 6; i++) col(8 - i, foreW[5 - i], S.base, cx);
      col(2, handW, S.base, cx);
      col(1, handW, S.base, cx);
      hands[side] = { x: m(cx), y: 1 };
    } else {
      for (let i = 0; i < 7; i++) col(18 + i + sw, upperW[i], S.base);
      if (ap === "down" || ap === "swingF" || ap === "swingB") {
        for (let i = 0; i < 6; i++) col(25 + i + sw, foreW[i], S.base);
        col(31 + sw, handW, S.base);
        col(32 + sw, handW, S.base);
        hands[side] = { x: m(armC), y: 32 + sw };
      }
    }
    shade(a, S);
    if (ap !== "up") {
      if (p.arms > 3) for (let y = 19; y <= 22; y++) set(a, m(armC - Math.floor((upperW[y - 18] - 1) / 2) + 1), y + sw, S.hi);
      if (p.arms > 5) for (let y = 20; y <= 23; y++) set(a, m(armC + Math.ceil((upperW[y - 18] - 1) / 2) - 1), y + sw, S.deep);
      if (p.arms > 7 && bf < 4 && (ap === "down" || ap.startsWith("swing"))) for (const y of [26, 28, 29]) set(a, m(armC), y + sw, pack(mix(skinRGB, [90, 130, 170], 0.45)));
    }
    arms[side] = a;
    // forearm folded up (curl / hold / bar) drawn as its own layer in front
    if (ap === "curl" || ap === "hold" || ap === "bar") {
      const f = layer();
      if (ap === "hold") {
        for (let y = 24; y < 24 + foreW[0]; y++) hspan(f, y, m(armC), m(13), S.base);
        hspan(f, 23, m(13), m(14), S.base);
        hspan(f, 24, m(13), m(14), S.base);
        hands[side] = { x: m(13), y: 22 };
      } else {
        const cx = ap === "bar" ? armC - 1 : armC + 1;
        const top = ap === "bar" ? 16 : 19;
        for (let y = top + 2; y <= 25; y++) {
          const w = foreW[Math.min(5, 25 - y)];
          hspan(f, y, m(cx - Math.floor((w - 1) / 2)), m(cx + Math.ceil((w - 1) / 2)), S.base);
        }
        hspan(f, top, m(cx), m(cx + handW - 1), S.base);
        hspan(f, top + 1, m(cx), m(cx + handW - 1), S.base);
        hands[side] = { x: m(cx), y: top };
      }
      shade(f, S);
      arms[side + 2] = f;
    }
  });

  // ---- legs
  const gap = 1 + Math.round(p.legs / 4); // stance widens with legs
  const thigh = kfRow(p.legs, [[4, 4, 4, 3, 3, 3], [5, 5, 5, 5, 4, 4], [7, 7, 7, 6, 6, 5]]).map((w) => w + (bf > 6.5 ? 1 : 0));
  const calf = kfRow(p.legs, [[3, 3, 3, 2, 2], [3, 4, 4, 3, 3], [4, 5, 5, 4, 3]]);
  const legs = layer();
  const shoes = layer();
  const shoeT = tone([236, 236, 230]);
  const hipTop = 29 + drop;
  const hipHalf = Math.max(halves[14], gap + thigh[0] - 1);
  for (let y = hipTop; y <= 32 + drop; y++) sym(legs, y, hipHalf, S.base);
  both((m, side) => {
    const lift = (pose.legs === "stepA" && side === 0) || (pose.legs === "stepB" && side === 1) ? 1 : 0;
    const out = lift && p.legs > 5 ? 1 : 0; // wide-legged waddle when big
    const inner = 15 - gap - out;
    const legRow = (y: number, w: number) => hspan(legs, y, m(inner - w + 1), m(inner), S.base);
    const thighIdx = thighRows === 6 ? [0, 1, 2, 3, 4, 5] : thighRows === 3 ? [0, 2, 4] : [1, 4];
    thighIdx.forEach((ti, i) => legRow(33 + drop + i, thigh[ti] + (pose.legs === "sit" ? 1 : 0)));
    legRow(39 - lift, Math.max(3, calf[0] - 1));
    for (let i = 0; i < 5; i++) legRow(40 + i - lift, calf[i]);
    const sw = calf[4] + 1;
    hspan(shoes, 45 - lift, m(inner - sw + 1), m(inner + 1), shoeT.base);
    hspan(shoes, 46 - lift, m(inner - sw), m(inner + 1), pack([70, 60, 58]));
  });
  shade(legs, S);
  shade(shoes, shoeT);
  both((m) => {
    const inner = 15 - gap;
    if (p.legs > 4 && thighRows === 6) set(legs, m(inner - 1), 37, S.hi); // teardrop
    if (p.legs > 6 && bf < 6 && thighRows === 6) for (let i = 0; i < 4; i++) set(legs, m(inner - thigh[1] + 2 + Math.floor(i / 2)), 34 + i, S.sh);
    if (p.legs > 5) set(legs, m(inner - calf[1] + 2), 41, S.hi);
    set(legs, m(inner - 1), 39, S.sh);
  });

  // ---- clothes
  const shortsL = clothFrom(legs, (x, y) => y >= hipTop && y <= 34 + drop - (thighRows < 6 ? 1 : 0), S, shortsT);
  hspan(shortsL, hipTop, 16 - hipHalf, 15 + hipHalf, shortsT.deep);

  let shirt = layer();
  let sleeves = layer();
  const sweating = o.sweat !== undefined;
  if (fit === "loose") {
    // loose tee drapes straight down from the widest point above each row
    let w = halves[0];
    for (let y = T; y <= 30; y++) {
      const rr = Math.min(14, y - T);
      w = Math.max(w, halves[rr] + 1);
      sym(shirt, y, y === T ? w - 1 : w, shirtT.base);
    }
    hspan(shirt, 30, 16 - w, 15 + w, 0);
    if (bf > 6) sym(shirt, 30, w - 2, shirtT.base); // belly pushes the hem out
    shade(shirt, shirtT);
    both((m) => {
      for (let y = 22; y <= 29; y++) set(shirt, m(13), y, shirtT.sh);
      if (p.chest > 4) hspan(shirt, pecY, m(12), m(14), shirtT.sh);
    });
    disc(sleeves, deltCx, deltCy + 0.6, r + 1.2, shirtT.base);
    disc(sleeves, 32 - deltCx, deltCy + 0.6, r + 1.2, shirtT.base);
    shade(sleeves, shirtT);
  } else if (fit === "tight") {
    shirt = clothFrom(torso, (_, y) => y >= T, S, shirtT);
    sleeves = clothFrom(deltL, () => true, S, shirtT);
    both((m) => {
      const a = arms[m(0) ? 1 : 0];
      for (let y = 18; y <= 19; y++) for (let x = 0; x < SW; x++) if (get(a, x, y) && Math.sign(x - 15.5) === (m(0) ? 1 : -1)) set(sleeves, x, y, get(a, x, y) === S.hi ? shirtT.hi : shirtT.base);
    });
  } else {
    shirt = clothFrom(torso, (x, y) => y >= T + 1 && (y > 21 || Math.abs(x - 15.5) < halves[y - T] - 2.5), S, shirtT);
    both((m) => {
      set(shirt, m(13), 14, shirtT.base);
      set(shirt, m(13), 15, shirtT.base);
    });
  }
  // collar: crew neck shows skin
  if (fit !== "tank") {
    hspan(shirt, T, 14, 17, 0);
    hspan(shirt, T + 1, 15, 16, 0);
  } else hspan(shirt, T + 1, 14, 17, 0);
  if (sweating) {
    // damp patches
    for (let y = 17; y <= 19; y++) for (let x = 14; x <= 17; x++) if (get(shirt, x, y)) set(shirt, x, y, shirtT.deep);
  }

  // ---- head
  const head = layer();
  const headHalf = [2, 3, 4, 4, 4, 4, 4, 4, 3, 2];
  headHalf.forEach((h, i) => sym(head, 3 + i, h + (bf > 6 && i >= 6 && i <= 8 ? 1 : 0), S.base));
  if (bf > 8) sym(head, 12, 3, S.base);
  both((m) => {
    set(head, m(11), 7, S.base);
    set(head, m(11), 8, S.base);
  });
  shade(head, S);
  const eyeY = pose.lookDown ? 9 : 8;
  both((m) => {
    set(head, m(13), eyeY, pack([40, 30, 30]));
    if (!pose.lookDown) set(head, m(13), eyeY - 1, S.sh);
  });
  hspan(head, 10 + (pose.lookDown ? 1 : 0), 15, 16, S.deep);
  if (str > 7) hspan(head, 10, 14, 17, S.deep); // determined grin

  const hair = layer();
  const H = hairT.base;
  switch (L.hair % 5) {
    case 0: // short crop
      sym(hair, 2, 3, H);
      sym(hair, 3, 4, H);
      sym(hair, 4, 4, H);
      both((m) => set(hair, m(12), 5, H));
      both((m) => set(hair, m(14), 5, H));
      break;
    case 1: // buzz
      sym(hair, 3, 3, H);
      sym(hair, 4, 4, H);
      break;
    case 2: // long
      sym(hair, 2, 3, H);
      sym(hair, 3, 4, H);
      sym(hair, 4, 4, H);
      both((m) => {
        for (let y = 5; y <= 11; y++) hspan(hair, y, m(11), m(12), H);
      });
      break;
    case 3: // bun
      sym(hair, 0, 1, H);
      sym(hair, 1, 2, H);
      sym(hair, 2, 3, H);
      sym(hair, 3, 4, H);
      both((m) => set(hair, m(12), 4, H));
      break;
    default: // bald: just a shine
      set(head, 13, 4, S.hi);
  }
  shade(hair, hairT);

  // ---- composite
  const out = layer();
  // ground shadow
  const shadowC = pack([0, 0, 0], 70);
  hspan(out, 47, 16 - gap - 6, 15 + gap + 6, shadowC);
  hspan(out, 46, 16 - gap - 4, 15 + gap + 4, shadowC);
  stamp(out, legs, outline);
  stamp(out, shortsL, outline);
  stamp(out, shoes, outline);
  const up = layer();
  stamp(up, torso, outline);
  stamp(up, shirt, outline);
  stamp(up, arms[0], outline);
  stamp(up, arms[1], outline);
  stamp(up, deltL, outline);
  stamp(up, sleeves, outline);
  if (arms[2]) stamp(up, arms[2], outline);
  if (arms[3]) stamp(up, arms[3], outline);
  stamp(up, head, outline);
  if (L.hair % 5 !== 4) stamp(up, hair, outline);
  // props in hand
  const props = layer();
  const steel = pack([160, 168, 178]);
  const plate = pack([45, 49, 56]);
  const drawAt = (h: { x: number; y: number }) => {
    if (pose.prop === "dumbbell") {
      hspan(props, h.y, h.x - 2, h.x + 2, steel);
      for (const dx of [-3, 3]) for (let dy = -1; dy <= 1; dy++) set(props, h.x + dx, h.y + dy, plate);
    } else if (pose.prop === "bottle") {
      for (let dy = -3; dy <= 0; dy++) hspan(props, h.y + dy, h.x, h.x + 1, pack([90, 170, 230]));
      hspan(props, h.y - 4, h.x, h.x + 1, pack([240, 240, 240]));
    } else if (pose.prop === "phone") {
      for (let dy = -3; dy <= 0; dy++) hspan(props, h.y + dy, h.x - 1, h.x + 1, pack([30, 30, 40]));
      for (let dy = -2; dy <= -1; dy++) set(props, h.x, h.y + dy, pack([120, 220, 255]));
    }
  };
  if (pose.prop === "barbell") {
    hspan(props, 14, 0, 31, steel);
    for (const x of [0, 1, 30, 31]) for (let y = 10; y <= 18; y++) set(props, x, y, x === 1 || x === 30 ? pack([180, 50, 50]) : plate);
  } else if (pose.prop) {
    const which = pose.propHand ?? 2;
    if (which !== 1 && hands[0]) drawAt(hands[0]);
    if (which !== 0 && hands[1]) drawAt(hands[1]);
  }
  stamp(up, props, outline);
  // sweat drops
  if (sweating) {
    const drops = [[10, 6], [21, 9], [11, 11], [20, 4], [9, 15], [22, 14]];
    const f = o.sweat!;
    for (let i = 0; i < 3; i++) {
      const [x, y] = drops[(f + i * 2) % drops.length];
      const fy = y + ((f + i) % 3);
      set(up, x, fy, pack([140, 210, 255]));
      set(up, x, fy + 1, pack([90, 170, 240]));
    }
  }
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const v = up[y * SW + x];
      if (v) set(out, x, y + upDy, v);
    }
  // fill any gap between torso and hips when standing tall
  if (upDy < 0) for (let y = 29 + upDy; y < 29 + drop; y++) sym(out, y, halves[14], get(out, 15, y) || S.base);

  if (o.glow) {
    const src = out.slice();
    const halo = pack(hex(GLOW), 110);
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++)
        if (!src[y * SW + x] && (get(src, x - 1, y) === outline || get(src, x + 1, y) === outline || get(src, x, y - 1) === outline || get(src, x, y + 1) === outline)) out[y * SW + x] = halo;
  }
  if (o.grey) {
    for (let i = 0; i < out.length; i++) {
      const v = out[i];
      if (!v) continue;
      const rr = v & 255, gg = (v >> 8) & 255, bb = (v >> 16) & 255, a = v >>> 24;
      const l = Math.round((0.3 * rr + 0.59 * gg + 0.11 * bb) * 0.7 + 40);
      out[i] = pack([l, l, l], a);
    }
  }
  return out;
}

// ---- canvas helpers (browser only) ----------------------------------------
const cache = new Map<string, HTMLCanvasElement>();
const r1 = (v: number) => Math.round(v * 10) / 10;

export function spriteCanvas(o: SpriteOpts): HTMLCanvasElement {
  const key = JSON.stringify([Object.values(o.params).map(r1), o.look, r1(o.sat ?? 1), o.pose, o.sweat, o.glow, o.grey]);
  let c = cache.get(key);
  if (c) return c;
  if (cache.size > 3000) cache.clear(); // ponytail: wholesale clear, LRU if it ever thrashes
  c = document.createElement("canvas");
  c.width = SW;
  c.height = SH;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(SW, SH);
  new Uint32Array(img.data.buffer).set(composeSprite(o));
  ctx.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}
