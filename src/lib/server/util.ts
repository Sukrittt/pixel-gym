import { randomBytes } from "node:crypto";
import { DEFAULT_START, type Entry } from "../body";
import { findExercise } from "../exercises";
import type { Member } from "../floor";
import { sanitize } from "../font";

export const newId = (n = 8) => randomBytes(n).toString("hex");
export function newCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(6), (b) => A[b % A.length]).join("");
}

export function cleanName(raw: unknown): string | null {
  const s = sanitize(String(raw ?? "")).replace(/\s+/g, " ").trim().slice(0, 12);
  return s.length >= 1 ? s : null;
}
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function newMember(name: string, today: string): Member {
  const h = [...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const r = (n: number, k: number) => Math.abs(Math.floor(h / k)) % n;
  return {
    id: newId(6),
    key: newId(16),
    name: titleCase(name),
    look: { skin: r(5, 1), hair: r(5, 7), hairColor: r(6, 13), shirt: r(7, 17), shorts: r(5, 23) },
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
