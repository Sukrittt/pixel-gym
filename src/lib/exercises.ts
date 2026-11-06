// Hardcoded exercise -> muscle map. Weights say how much of each set's volume
// lands on each group. `bw` = fraction of bodyweight moved when kg is 0.
export type Muscle = "shoulders" | "arms" | "chest" | "back" | "legs";
export type Group = Muscle | "core";
export type Zone = "weights" | "squat" | "cardio" | "mat" | "bar" | "lockers" | "outside";

export type Exercise = {
  name: string;
  m: Partial<Record<Group, number>>;
  bw?: number;
  cardio?: boolean;
  aliases?: string[];
};

export const EXERCISES: Exercise[] = [
  // chest / push
  { name: "Bench Press", m: { chest: 1, shoulders: 0.4, arms: 0.4 }, aliases: ["flat bench", "barbell bench press"] },
  { name: "Incline Bench Press", m: { chest: 0.9, shoulders: 0.6, arms: 0.4 } },
  { name: "Decline Bench Press", m: { chest: 1, arms: 0.4 } },
  { name: "Dumbbell Bench Press", m: { chest: 1, shoulders: 0.4, arms: 0.3 }, aliases: ["db bench"] },
  { name: "Incline Dumbbell Press", m: { chest: 0.9, shoulders: 0.6, arms: 0.3 } },
  { name: "Chest Fly", m: { chest: 1 }, aliases: ["dumbbell fly", "pec deck", "butterfly"] },
  { name: "Cable Crossover", m: { chest: 1 }, aliases: ["cable fly"] },
  { name: "Push Up", m: { chest: 0.9, shoulders: 0.4, arms: 0.4, core: 0.2 }, bw: 0.65, aliases: ["pushup", "push-up"] },
  { name: "Chest Dip", m: { chest: 0.8, arms: 0.7, shoulders: 0.3 }, bw: 0.95, aliases: ["dips", "dip"] },
  { name: "Machine Chest Press", m: { chest: 1, arms: 0.3 }, aliases: ["chest press"] },
  // shoulders
  { name: "Overhead Press", m: { shoulders: 1, arms: 0.5, chest: 0.2 }, aliases: ["military press", "ohp", "standing press"] },
  { name: "Seated Dumbbell Press", m: { shoulders: 1, arms: 0.4 }, aliases: ["shoulder press", "dumbbell shoulder press"] },
  { name: "Arnold Press", m: { shoulders: 1, arms: 0.4 } },
  { name: "Lateral Raise", m: { shoulders: 1 }, aliases: ["side raise", "lateral raises"] },
  { name: "Front Raise", m: { shoulders: 1 } },
  { name: "Rear Delt Fly", m: { shoulders: 0.8, back: 0.4 }, aliases: ["reverse fly", "rear delt"] },
  { name: "Face Pull", m: { shoulders: 0.7, back: 0.5 } },
  { name: "Upright Row", m: { shoulders: 0.8, back: 0.4 } },
  { name: "Shrug", m: { back: 0.6, shoulders: 0.4 }, aliases: ["shrugs"] },
  // back / pull
  { name: "Deadlift", m: { legs: 0.8, back: 0.9, core: 0.3 }, aliases: ["conventional deadlift"] },
  { name: "Pull Up", m: { back: 1, arms: 0.5 }, bw: 1, aliases: ["pullup", "pull-up"] },
  { name: "Chin Up", m: { back: 0.8, arms: 0.8 }, bw: 1, aliases: ["chinup", "chin-up"] },
  { name: "Lat Pulldown", m: { back: 1, arms: 0.4 }, aliases: ["pulldown"] },
  { name: "Barbell Row", m: { back: 1, arms: 0.4, shoulders: 0.2 }, aliases: ["bent over row", "pendlay row", "row"] },
  { name: "Dumbbell Row", m: { back: 1, arms: 0.4 }, aliases: ["one arm row", "single arm row"] },
  { name: "Seated Cable Row", m: { back: 1, arms: 0.4 }, aliases: ["cable row", "seated row"] },
  { name: "T-Bar Row", m: { back: 1, arms: 0.3 } },
  { name: "Straight Arm Pulldown", m: { back: 1 }, aliases: ["pullover"] },
  { name: "Back Extension", m: { back: 0.6, legs: 0.4 }, bw: 0.5, aliases: ["hyperextension"] },
  // arms
  { name: "Bicep Curl", m: { arms: 1 }, aliases: ["barbell curl", "dumbbell curl", "biceps curl", "curl"] },
  { name: "Hammer Curl", m: { arms: 1 } },
  { name: "Preacher Curl", m: { arms: 1 } },
  { name: "Cable Curl", m: { arms: 1 } },
  { name: "Tricep Pushdown", m: { arms: 1 }, aliases: ["triceps pushdown", "rope pushdown", "pushdown"] },
  { name: "Skull Crusher", m: { arms: 1 }, aliases: ["lying tricep extension", "skullcrusher"] },
  { name: "Overhead Tricep Extension", m: { arms: 1 }, aliases: ["triceps extension", "tricep extension"] },
  { name: "Close Grip Bench Press", m: { arms: 0.8, chest: 0.6 } },
  { name: "Tricep Dip", m: { arms: 1, chest: 0.3 }, bw: 0.9, aliases: ["bench dip"] },
  { name: "Wrist Curl", m: { arms: 1 } },
  // legs
  { name: "Squat", m: { legs: 1, core: 0.2 }, aliases: ["back squat", "barbell squat", "high bar squat", "low bar squat"] },
  { name: "Front Squat", m: { legs: 1, core: 0.3 } },
  { name: "Leg Press", m: { legs: 1 } },
  { name: "Romanian Deadlift", m: { legs: 0.8, back: 0.4 }, aliases: ["rdl", "stiff leg deadlift"] },
  { name: "Lunge", m: { legs: 1 }, bw: 0.7, aliases: ["walking lunge", "lunges"] },
  { name: "Bulgarian Split Squat", m: { legs: 1 }, bw: 0.7, aliases: ["split squat"] },
  { name: "Leg Extension", m: { legs: 1 } },
  { name: "Leg Curl", m: { legs: 1 }, aliases: ["hamstring curl", "lying leg curl", "seated leg curl"] },
  { name: "Hip Thrust", m: { legs: 1 }, aliases: ["glute bridge"] },
  { name: "Calf Raise", m: { legs: 1 }, aliases: ["standing calf raise", "seated calf raise"] },
  { name: "Goblet Squat", m: { legs: 1 } },
  { name: "Hack Squat", m: { legs: 1 } },
  // core / mobility
  { name: "Plank", m: { core: 1 }, bw: 0.4 },
  { name: "Crunch", m: { core: 1 }, bw: 0.3, aliases: ["crunches", "sit up", "situp"] },
  { name: "Hanging Leg Raise", m: { core: 1 }, bw: 0.4, aliases: ["leg raise"] },
  { name: "Cable Crunch", m: { core: 1 } },
  { name: "Russian Twist", m: { core: 1 }, bw: 0.3 },
  { name: "Ab Wheel", m: { core: 1 }, bw: 0.5, aliases: ["ab rollout"] },
  { name: "Stretching", m: { core: 0.3 }, bw: 0.1, aliases: ["mobility", "yoga", "stretch"] },
  // cardio
  { name: "Running", m: {}, cardio: true, aliases: ["run", "treadmill", "jog", "outdoor run"] },
  { name: "Cycling", m: {}, cardio: true, aliases: ["bike", "stationary bike", "spin"] },
  { name: "Rowing", m: {}, cardio: true, aliases: ["rower", "row machine", "rowing machine"] },
  { name: "Elliptical", m: {}, cardio: true, aliases: ["cross trainer"] },
  { name: "Stair Climber", m: {}, cardio: true, aliases: ["stairmaster", "stair machine"] },
  { name: "Jump Rope", m: {}, cardio: true, aliases: ["skipping"] },
  { name: "Walking", m: {}, cardio: true, aliases: ["walk", "incline walk"] },
];

const norm = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

const INDEX = new Map<string, Exercise>();
for (const e of EXERCISES) {
  INDEX.set(norm(e.name), e);
  for (const a of e.aliases ?? []) INDEX.set(norm(a), e);
}

/**
 * Resolve a free-text exercise name (Hevy/Strong titles included) to the map.
 * `prefix` (typing in the log form only) also guesses from a partial name; the server stays strict.
 */
export function findExercise(raw: string, opts: { prefix?: boolean } = {}): Exercise | undefined {
  const n = norm(raw);
  if (!n) return undefined;
  const hit = INDEX.get(n) ?? INDEX.get(n.replace(/s$/, ""));
  if (hit) return hit;
  // Token overlap fallback: "Incline Bench Press (Dumbbell)" etc.
  const tokens = new Set(n.split(" "));
  let best: Exercise | undefined;
  let bestScore = 0;
  for (const [key, e] of INDEX) {
    const kt = key.split(" ");
    const overlap = kt.filter((t) => tokens.has(t) || tokens.has(t + "s")).length;
    const score = overlap / Math.max(kt.length, tokens.size);
    if (overlap === kt.length && score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  if (best || !opts.prefix || n.length < 3) return best;
  // prefix while typing: "bench" -> Bench Press, "lat p" -> Lat Pulldown (list order = most common first).
  // Lifts only: a lifter typing "row" means a row, not the rowing machine.
  const lifts = EXERCISES.filter((e) => !e.cardio);
  return lifts.find((e) => norm(e.name).startsWith(n)) ?? lifts.find((e) => e.aliases?.some((a) => norm(a).startsWith(n)));
}

/** Which station an exercise sends you to, and the label on your name tag. */
export function classify(vol: Partial<Record<Group, number>>, cardioMin: number): { zone: Zone; focus: string } {
  const push = (vol.chest ?? 0) + (vol.shoulders ?? 0);
  const pull = vol.back ?? 0;
  const arms = vol.arms ?? 0;
  const legs = vol.legs ?? 0;
  const core = vol.core ?? 0;
  const max = Math.max(push, pull, arms, legs, core);
  if (max <= 0) return cardioMin > 0 ? { zone: "cardio", focus: "Cardio" } : { zone: "bar", focus: "Weigh-in" };
  if (max === legs) return { zone: "squat", focus: "Legs" };
  if (max === push) return { zone: "weights", focus: "Push" };
  if (max === pull) return { zone: "weights", focus: "Pull" };
  if (max === arms) return { zone: "weights", focus: "Arms" };
  return { zone: "mat", focus: "Core" };
}
