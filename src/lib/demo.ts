// Deterministic demo floor: 8 fake lifters with different histories, so the
// landing page and /demo look alive with zero logins.
import { addDays, applyEntry, DEFAULT_START, type Entry, type History } from "./body";
import type { FloorDoc, Member } from "./floor";
import type { Look } from "./sprite";

type Session = Entry[];
const L = (exercise: string, sets: number, reps: number, kg: number): Entry => ({ kind: "lift", exercise, sets, reps, kg });
const PUSH: Session = [L("Bench Press", 4, 8, 70), L("Overhead Press", 3, 8, 42), L("Incline Dumbbell Press", 3, 10, 26), L("Lateral Raise", 3, 15, 10), L("Tricep Pushdown", 3, 12, 30)];
const PULL: Session = [L("Deadlift", 3, 5, 130), L("Pull Up", 4, 8, 0), L("Barbell Row", 3, 10, 65), L("Face Pull", 3, 15, 20), L("Bicep Curl", 3, 12, 14)];
const LEGS: Session = [L("Squat", 5, 5, 110), L("Romanian Deadlift", 3, 8, 90), L("Leg Press", 3, 12, 180), L("Calf Raise", 4, 15, 60)];
const ARMS: Session = [L("Bicep Curl", 4, 12, 14), L("Hammer Curl", 3, 12, 16), L("Skull Crusher", 3, 10, 30), L("Tricep Pushdown", 3, 12, 30)];
const CORE: Session = [L("Plank", 3, 1, 0), L("Hanging Leg Raise", 3, 12, 0), L("Ab Wheel", 3, 10, 0), L("Stretching", 1, 10, 0)];
const RUN = (km: number, min: number): Session => [{ kind: "cardio", exercise: "Running", minutes: min, km }];

type Plan = {
  id: string;
  name: string;
  look: Look;
  start?: Partial<History["start"]>;
  days: number; // history length
  stopAgo?: number; // stopped training this many days ago
  week: (Session | null)[]; // 7-day program
  bw?: (d: number) => number;
  today: Session | "rest" | "weigh" | null;
  todayMinAgo: number;
  prToday?: boolean;
};

const PLANS: Plan[] = [
  { id: "maya", name: "Maya", look: { skin: 1, hair: 3, hairColor: 0, shirt: 0, shorts: 1 }, days: 150, week: [PUSH, PULL, null, LEGS, PUSH, PULL, null], today: PUSH, todayMinAgo: 25, prToday: true },
  { id: "rico", name: "Rico", look: { skin: 2, hair: 1, hairColor: 0, shirt: 6, shorts: 0 }, start: { legs: 3 }, days: 220, week: [LEGS, null, PUSH, LEGS, null, PULL, LEGS], today: LEGS, todayMinAgo: 40 },
  { id: "dev", name: "Dev", look: { skin: 3, hair: 0, hairColor: 0, shirt: 2, shorts: 3 }, start: { bodyfat: 8 }, days: 120, week: [RUN(6, 38), null, RUN(8, 48), RUN(5, 30), null, RUN(10, 58), CORE], bw: (d) => 96 - d * 0.07, today: RUN(9.5, 52), todayMinAgo: 15 },
  { id: "jun", name: "Jun", look: { skin: 0, hair: 2, hairColor: 3, shirt: 5, shorts: 4 }, days: 12, week: [ARMS, null, PUSH, null, ARMS, null, PULL], today: ARMS, todayMinAgo: 8 },
  { id: "olu", name: "Olu", look: { skin: 4, hair: 4, hairColor: 0, shirt: 3, shorts: 1 }, start: { shoulders: 6, arms: 6, chest: 6.5, back: 6.5, legs: 6, bodyfat: 3 }, days: 330, week: [PULL, PUSH, LEGS, null, PULL, PUSH, LEGS], today: PULL, todayMinAgo: 55 },
  { id: "priya", name: "Priya", look: { skin: 2, hair: 2, hairColor: 1, shirt: 4, shorts: 2 }, days: 90, stopAgo: 12, week: [PUSH, null, LEGS, null, PULL, null, CORE], today: null, todayMinAgo: 0 },
  { id: "sam", name: "Sam", look: { skin: 1, hair: 0, hairColor: 4, shirt: 1, shorts: 0 }, days: 60, week: [CORE, ARMS, null, CORE, null, ARMS, CORE], today: CORE, todayMinAgo: 30 },
  { id: "lena", name: "Lena", look: { skin: 0, hair: 3, hairColor: 2, shirt: 2, shorts: 3 }, start: { bodyfat: 6 }, days: 75, week: [LEGS, PUSH, null, PULL, LEGS, null, RUN(5, 30)], bw: (d) => 70 - d * 0.03, today: "weigh", todayMinAgo: 5 },
];

function buildMember(plan: Plan, today: string, now: number): Member {
  const joined = addDays(today, -plan.days);
  const h: History = { joined, start: { ...DEFAULT_START, ...plan.start }, days: {}, bests: {} };
  for (let d = 0; d < plan.days; d++) {
    const date = addDays(joined, d);
    if (plan.stopAgo !== undefined && d > plan.days - plan.stopAgo) break;
    const at = `${date}T07:30:00.000Z`;
    if (plan.bw && d % 3 === 0) applyEntry(h, { kind: "weight", bw: Math.round(plan.bw(d) * 10) / 10 }, date, at);
    const s = plan.week[d % 7];
    // progressive overload: loads creep up ~0.15%/day
    const k = 1 + d * 0.0015;
    for (const e of s ?? []) applyEntry(h, e.kind === "lift" ? { ...e, kg: Math.round(e.kg * k * 2) / 2 } : e, date, at);
  }
  const at = new Date(now - plan.todayMinAgo * 60000).toISOString();
  if (plan.today === "rest") applyEntry(h, { kind: "rest" }, today, at);
  else if (plan.today === "weigh") applyEntry(h, { kind: "weight", bw: Math.round((plan.bw?.(plan.days) ?? 70) * 10) / 10 }, today, at);
  else if (plan.today) {
    const k = 1 + plan.days * 0.0015;
    for (const e of plan.today) applyEntry(h, e.kind === "lift" ? { ...e, kg: Math.round(e.kg * k * 2) / 2 } : e, today, at);
    if (plan.prToday) {
      const ex = plan.today.find((e) => e.kind === "lift");
      if (ex?.kind === "lift") applyEntry(h, { ...ex, sets: 1, reps: 3, kg: (h.bests[ex.exercise] ?? ex.kg) + 2.5 }, today, new Date(now - 2 * 60000).toISOString());
    }
  }
  return { ...h, id: plan.id, name: plan.name, look: plan.look };
}

export function makeDemoFloor(today: string, now: number): FloorDoc {
  return { code: "DEMO", name: "Demo Gym", created: today, members: PLANS.map((p) => buildMember(p, today, now)), emotes: [] };
}
