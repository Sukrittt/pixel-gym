import { simulate, streak, weeklyVolume, withPump, addDays, type DayAgg, type History, type Params, type Snapshot } from "./body";
import type { Look } from "./sprite";

export type Member = History & { id: string; name: string; look: Look; key?: string; recentLogs?: string[]; importedSets?: string[] };
export type EmoteKind = "bump" | "flex" | "clap";
export type Emote = { id: string; from: string; to: string; kind: EmoteKind; at: string };
export type FloorDoc = { code: string; name: string; created: string; members: Member[]; emotes: Emote[] };

export type Snap = { p: Params; sat: number };
export type MemberView = {
  id: string;
  name: string;
  look: Look;
  params: Params; // today, with pump
  sat: number;
  streak: number;
  weekly: number;
  today: DayAgg | null;
  snaps: { day1: Snap; ago30: Snap; now: Snap };
  days: number; // days of history (for hiding empty comparisons)
};
export type FloorView = { code: string; name: string; today: string; members: MemberView[]; emotes: Emote[]; demo?: boolean };

const snap = (s: Snapshot): Snap => ({ p: s.p, sat: s.sat });

export function memberView(m: Member, today: string, now: number): MemberView {
  const series = simulate(m, today);
  const last = series[series.length - 1];
  const day = m.days[today];
  const trainedToday = !!day && (day.sets > 0 || day.cardioMin > 0 || !!day.bw || day.focus === "Rest");
  return {
    id: m.id,
    name: m.name,
    look: m.look,
    params: withPump(last.p, day, now),
    sat: last.sat,
    streak: streak(m.days, today),
    weekly: weeklyVolume(m.days, today),
    today: trainedToday ? day : null,
    // day1 = the starting body before any training; ago30 only meaningful with 30+ days
    snaps: { day1: { p: m.start, sat: series[0].sat }, ago30: snap(series[Math.max(0, series.length - 31)]), now: snap(last) },
    days: series.length,
  };
}

export function buildFloorView(doc: FloorDoc, today: string, now: number): FloorView {
  const cutoff = new Date(now - 60_000).toISOString();
  return {
    code: doc.code,
    name: doc.name,
    today,
    members: doc.members.map((m) => memberView(m, today, now)),
    emotes: doc.emotes.filter((e) => e.at > cutoff),
  };
}

/** Daily snapshots for the timelapse, thinned to at most ~400 points. */
export function seriesFor(m: Member, today: string): Snapshot[] {
  const s = simulate(m, today);
  const step = Math.ceil(s.length / 400);
  return s.filter((_, i) => i % step === 0 || i === s.length - 1);
}

export const localDate = (d = new Date()) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

/** Clamp a client-supplied "today" to within a day of server time. */
export function safeToday(s: string | null | undefined): string {
  const utc = new Date().toISOString().slice(0, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return utc;
  return s === utc || s === addDays(utc, -1) || s === addDays(utc, 1) ? s : utc;
}

export function formatKg(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}K KG` : `${Math.round(kg)} KG`;
}

export function tagFor(v: MemberView): string {
  const t = v.today;
  const n = v.name.toUpperCase();
  if (!t) return `${n} · OFF TODAY`;
  if (t.focus === "Cardio") return `${n} · CARDIO · ${t.km.toFixed(1)} KM`;
  if (t.focus === "Weigh-in") return `${n} · ${t.bw ?? "?"} KG`;
  if (t.focus === "Rest") return `${n} · REST DAY`;
  return `${n} · ${t.focus.toUpperCase()} · ${formatKg(t.total)}`;
}

/** Floor view as of right now (server-side first paint). */
export const floorViewNow = (doc: FloorDoc, today: string) => buildFloorView(doc, today, Date.now());

export type MeDay = { date: string; focus: string; total: number; sets: number; cardioMin: number; km: number; bw?: number; pr: boolean };
export type MeData = { code: string; floorName: string; me: MemberView; series: Snapshot[]; days: MeDay[] };

/** Everything /me shows (server-rendered). */
export function meData(doc: FloorDoc, m: Member, today: string): MeData {
  const days = Object.entries(m.days)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, d]) => ({ date, focus: d.focus, total: Math.round(d.total), sets: d.sets, cardioMin: d.cardioMin, km: d.km, bw: d.bw, pr: !!d.pr }));
  return { code: doc.code, floorName: doc.name, me: memberView(m, today, Date.now()), series: seriesFor(m, today), days };
}

/** Member views as of right now (server render of the invite strip). */
export const memberViewsNow = (members: Member[], today: string) => members.map((m) => memberView(m, today, Date.now()));
