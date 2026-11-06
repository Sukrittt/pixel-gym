import { randomBytes } from "node:crypto";
import { DEFAULT_START, type Entry } from "../body";
import { findExercise } from "../exercises";
import type { Member } from "../floor";
import { sanitize } from "../font";
import { LOOK_MAX } from "../sprite";

export const newId = (n = 8) => randomBytes(n).toString("hex");
export function newCode() {
  // no look-alikes in the pixel font: Z/2, S/5, O/0, I/1, B/8
  const A = "ACDEFGHJKLMNPQRTUVWXY34679";
  return Array.from(randomBytes(6), (b) => A[b % A.length]).join("");
}

export function cleanName(raw: unknown, max = 12): string | null {
  const full = sanitize(String(raw ?? "")).replace(/\s+/g, " ").trim();
  let s = full.slice(0, max);
  // don't cut mid-word when there's a space to break at
  if (full.length > max && full[max] !== " " && s.lastIndexOf(" ") >= max / 2) s = s.slice(0, s.lastIndexOf(" "));
  s = s.trim();
  return s.length >= 1 ? s : null;
}
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function newMember(name: string, today: string): Member {
  return {
    id: newId(6),
    key: newId(16),
    name: titleCase(name),
    look: randomLook(),
    joined: today,
    start: { ...DEFAULT_START },
    days: {},
    bests: {},
  };
}

const num = (v: unknown, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

/** Validate one client-sent entry at the trust boundary. */
export function cleanEntry(e: unknown): Entry | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  if (o.kind === "rest") return { kind: "rest" };
  if (o.kind === "weight") {
    const bw = num(o.bw, 25, 350);
    return bw === null ? null : { kind: "weight", bw: Math.round(bw * 10) / 10 };
  }
  if (o.kind === "cardio") {
    const minutes = num(o.minutes, 0.5, 600), km = num(o.km ?? 0, 0, 300);
    return minutes === null || km === null ? null : { kind: "cardio", minutes, km, exercise: typeof o.exercise === "string" ? o.exercise.slice(0, 60) : undefined };
  }
  if (o.kind === "lift") {
    const ex = typeof o.exercise === "string" ? findExercise(o.exercise) : undefined;
    const sets = num(o.sets, 1, 30), reps = num(o.reps, 1, 200), kg = num(o.kg ?? 0, 0, 700);
    if (!ex || sets === null || reps === null || kg === null) return null;
    return { kind: "lift", exercise: ex.name, sets: Math.round(sets), reps: Math.round(reps), kg };
  }
  return null;
}

// only pairs that ever appeared in an issued alphabet (old: ...Z S B 2 5 8; new has none)
const SWAP: Record<string, string> = { "2": "Z", Z: "2", "5": "S", S: "5", "8": "B", B: "8" };
/**
 * Codes to try for a typed invite code: as typed first, then every combination
 * of look-alike swaps per position (old codes mix e.g. Z and 5: "2Q5Y8D" -> "ZQ5Y8D").
 */
export function codeVariants(code: string): string[] {
  let out = [""];
  for (const c of code) {
    const alts = SWAP[c] ? [c, SWAP[c]] : [c];
    out = out.flatMap((p) => alts.map((a) => p + a));
    if (out.length > 16) return [code]; // at most 4 look-alikes; beyond that, exact match only
  }
  return out; // first entry is always the code as typed
}

/** Validate a client-chosen look. */
export function cleanLook(v: unknown): Member["look"] | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out = {} as Member["look"];
  for (const [k, max] of Object.entries(LOOK_MAX) as [keyof typeof LOOK_MAX, number][]) {
    const n = Number(o[k]);
    if (typeof o[k] !== "number" || !Number.isInteger(n) || n < 0 || n >= max) return null;
    out[k] = n;
  }
  return out;
}

export function randomLook(): Member["look"] {
  const b = randomBytes(5);
  return { skin: b[0] % 5, hair: [0, 1, 2, 3, 0, 1, 2, 3, 4][b[1] % 9], hairColor: b[2] % 6, shirt: b[3] % 7, shorts: b[4] % 5 };
}
