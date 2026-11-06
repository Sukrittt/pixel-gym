import type { Entry } from "./body";

export type Lift = Extract<Entry, { kind: "lift" }>;
export const lift = (exercise: string, sets: number, reps: number, kg: number): Lift => ({ kind: "lift", exercise, sets, reps, kg });
export const TEMPLATES: Record<string, Lift[]> = {
  "PUSH DAY": [lift("Bench Press", 4, 8, 60), lift("Overhead Press", 3, 8, 35), lift("Lateral Raise", 3, 15, 8), lift("Tricep Pushdown", 3, 12, 25)],
  "PULL DAY": [lift("Pull Up", 4, 8, 0), lift("Barbell Row", 3, 10, 50), lift("Lat Pulldown", 3, 12, 45), lift("Bicep Curl", 3, 12, 12)],
  "LEG DAY": [lift("Squat", 5, 5, 80), lift("Romanian Deadlift", 3, 8, 60), lift("Leg Press", 3, 12, 120), lift("Calf Raise", 3, 15, 40)],
  ARMS: [lift("Bicep Curl", 3, 12, 12), lift("Hammer Curl", 3, 12, 12), lift("Skull Crusher", 3, 10, 25), lift("Tricep Pushdown", 3, 12, 25)],
  CORE: [lift("Plank", 3, 1, 0), lift("Hanging Leg Raise", 3, 12, 0), lift("Crunch", 3, 20, 0)],
};

/** A weekly plan slot: "" = rest day, "GYM" = gym day without a template, or a template name. */
export const PLAN_SLOTS = ["", "GYM", ...Object.keys(TEMPLATES)];
