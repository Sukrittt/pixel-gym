import { classify, findExercise, type Group, type Muscle, type Zone } from "./exercises";

export const MUSCLES: Muscle[] = ["shoulders", "arms", "chest", "back", "legs"];
export const PARAMS = [...MUSCLES, "bodyfat"] as const;
export type Param = (typeof PARAMS)[number];
export type Params = Record<Param, number>;

/** One day of training for one user, aggregated. Raw sets are not kept. */
export type DayAgg = {
  vol: Partial<Record<Group, number>>; // volume-load (sets*reps*kg*weight) per group
  total: number; // kg moved (sets*reps*load)
  sets: number;
  cardioMin: number;
  km: number;
  bw?: number;
  zone: Zone;
  focus: string;
  at: string; // ISO time of the latest log that day
  pr?: string; // ISO time of the latest PR that day
};

export type History = {
  joined: string; // YYYY-MM-DD
  start: Params;
  days: Record<string, DayAgg>;
  bests: Record<string, number>;
};

export type Entry =
  | { kind: "lift"; exercise: string; sets: number; reps: number; kg: number }
  | { kind: "cardio"; exercise?: string; minutes: number; km: number }
  | { kind: "weight"; bw: number }
  | { kind: "rest" };

export const DEFAULT_START: Params = { shoulders: 1.5, arms: 1.5, chest: 1.5, back: 1.5, legs: 1.5, bodyfat: 5 };

// ---- model constants -------------------------------------------------------
export const GAIN = 1.0; // max param gain from one saturating session at 0
export const V0 = 2500; // volume-load that gives ~63% of max session gain
// legs move far more load per set (leg press, squats), so they need more volume
const V0_BY: Partial<Record<Group, number>> = { legs: 6000, back: 3500 };
export const v0 = (m: Group) => V0_BY[m] ?? V0;
const weeklyCap = (m: Group) => 5 * v0(m); // weekly volume past which extra sets are junk
export const PUMP = 1.2; // temporary same-day boost so a session shows instantly
export const DECAY_AFTER = 7; // days without a log before decay
export const DECAY = 0.1; // per day
const DEFAULT_BW = 75;

const clamp = (v: number, lo = 0, hi = 10) => Math.min(hi, Math.max(lo, v));

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

/** Diminishing returns: more headroom near 0, almost none near 10. */
export const headroom = (p: number) => Math.pow(Math.max(0, 10 - p) / 10, 2.2);

/** Gain for one muscle from one day's volume, given trailing weekly volume. */
export function sessionGain(p: number, vol: number, weekly: number, m: Group = "chest"): number {
  if (vol <= 0) return 0;
  const sat = 1 - Math.exp(-vol / v0(m));
  const cap = weeklyCap(m);
  const junk = weekly > cap ? cap / weekly : 1;
  return GAIN * sat * headroom(p) * junk;
}

const trained = (d?: DayAgg) => !!d && (d.sets > 0 || d.cardioMin > 0);

export type Snapshot = { date: string; p: Params; sat: number };

/** Replay a user's whole history day by day. Pure and deterministic. */
export function simulate(h: History, until: string): Snapshot[] {
  const out: Snapshot[] = [];
  const p: Params = { ...h.start };
  const week: Partial<Record<Group, number>>[] = [];
  let lastTrain: string | null = null;
  let bwEma: number | undefined;
  const n = Math.max(0, daysBetween(h.joined, until));
  for (let i = 0; i <= n; i++) {
    const date = addDays(h.joined, i);
    const day = h.days[date];
    const weekly = (m: Group) => week.reduce((s, w) => s + (w[m] ?? 0), 0);
    if (trained(day)) {
      for (const m of MUSCLES) p[m] = clamp(p[m] + sessionGain(p[m], day!.vol[m] ?? 0, weekly(m), m));
      lastTrain = date;
      // cardio and lifting burn a little fat
      p.bodyfat -= 0.05 * (1 - Math.exp(-day!.cardioMin / 40)) + (day!.sets > 0 ? 0.01 : 0);
    }
    if (day?.bw) {
      // weight trend: rising bodyweight EMA adds fat, falling removes it
      const prev = bwEma;
      bwEma = prev === undefined ? day.bw : prev * 0.7 + day.bw * 0.3;
      if (prev !== undefined) p.bodyfat += (bwEma - prev) * 0.6;
    }
    const gap = daysBetween(lastTrain ?? h.joined, date);
    if (gap >= DECAY_AFTER) {
      for (const m of MUSCLES) p[m] = clamp(p[m] - DECAY);
      p.bodyfat += 0.05;
    }
    p.bodyfat += (5 - p.bodyfat) * 0.006; // drift back toward average without effort
    p.bodyfat = clamp(p.bodyfat);
    week.push(day?.vol ?? {});
    if (week.length > 7) week.shift();
    // skin saturation: share of the last 14 days with training (7+ = full)
    let active = 0;
    for (let k = 0; k < 14; k++) if (trained(h.days[addDays(date, -k)])) active++;
    out.push({ date, p: { ...p }, sat: 0.55 + 0.5 * Math.min(1, active / 7) });
  }
  return out;
}

/** Same-day pump on top of the stored params, fading over ~4h after the session. */
export function withPump(p: Params, day: DayAgg | undefined, now: number): Params {
  if (!day) return p;
  const hours = (now - Date.parse(day.at)) / 3600000;
  const fade = clamp(1 - hours / 4, 0, 1);
  const out = { ...p };
  for (const m of MUSCLES) out[m] = clamp(p[m] + PUMP * (1 - Math.exp(-(day.vol[m] ?? 0) / v0(m))) * fade);
  return out;
}

export function streak(days: Record<string, DayAgg>, today: string): number {
  let d = trained(days[today]) ? today : addDays(today, -1);
  let n = 0;
  while (trained(days[d])) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function weeklyVolume(days: Record<string, DayAgg>, today: string): number {
  let s = 0;
  for (let k = 0; k < 7; k++) s += days[addDays(today, -k)]?.total ?? 0;
  return Math.round(s);
}

function latestBw(h: History, date: string): number {
  for (let k = 0; k < 60; k++) {
    const bw = h.days[addDays(date, -k)]?.bw;
    if (bw) return bw;
  }
  return DEFAULT_BW;
}

const emptyDay = (at: string): DayAgg => ({ vol: {}, total: 0, sets: 0, cardioMin: 0, km: 0, zone: "lockers", focus: "Rest", at });

/** Fold one logged entry into the history. Returns whether it was a PR. Mutates h. */
export function applyEntry(h: History, e: Entry, date: string, at: string): { pr: boolean } {
  const day = (h.days[date] ??= emptyDay(at));
  if (at >= day.at) day.at = at;
  const latest = at >= day.at;
  if (daysBetween(date, h.joined) > 0) h.joined = date;
  if (e.kind === "rest") {
    if (day.sets === 0 && day.cardioMin === 0) Object.assign(day, { zone: "lockers", focus: "Rest" });
    return { pr: false };
  }
  if (e.kind === "weight") {
    day.bw = e.bw;
    if (latest && day.sets === 0 && day.cardioMin === 0) Object.assign(day, { zone: "bar", focus: "Weigh-in" });
    return { pr: false };
  }
  if (e.kind === "cardio") {
    day.cardioMin += e.minutes;
    day.km += e.km;
    if (latest) Object.assign(day, { zone: "cardio", focus: "Cardio" });
    return { pr: false };
  }
  const ex = findExercise(e.exercise);
  if (!ex) return { pr: false };
  if (ex.cardio) {
    // a "Running" row with reps/kg makes no sense; treat reps as minutes
    return applyEntry(h, { kind: "cardio", minutes: e.reps * e.sets, km: 0 }, date, at);
  }
  const load = e.kg > 0 ? e.kg : (ex.bw ?? 0.5) * latestBw(h, date);
  const work = e.sets * e.reps * load;
  const entryVol: Partial<Record<Group, number>> = {};
  for (const [g, w] of Object.entries(ex.m) as [Group, number][]) {
    entryVol[g] = work * w;
    day.vol[g] = (day.vol[g] ?? 0) + work * w;
  }
  day.total += work;
  day.sets += e.sets;
  if (latest) Object.assign(day, classify(entryVol, 0));
  let pr = false;
  if (e.kg > 0 && e.kg > (h.bests[ex.name] ?? 0)) {
    pr = (h.bests[ex.name] ?? 0) > 0; // first time doing a lift isn't a PR
    h.bests[ex.name] = e.kg;
    if (pr && (!day.pr || at > day.pr)) day.pr = at;
  }
  return { pr };
}
