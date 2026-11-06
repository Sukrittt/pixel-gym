import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyEntry, DEFAULT_START, headroom, planFor, sessionGain, simulate, streak, withPump, addDays, type History } from "./body";
import { parseWorkoutCsv, parseDate, parseCsv } from "./csv";
import { EXERCISES, findExercise } from "./exercises";

const fresh = (joined = "2026-01-01"): History => ({ joined, start: { ...DEFAULT_START }, days: {}, bests: {} });
const push = (h: History, date: string) => {
  applyEntry(h, { kind: "lift", exercise: "Bench Press", sets: 4, reps: 8, kg: 60 }, date, date + "T08:00:00.000Z");
  applyEntry(h, { kind: "lift", exercise: "Overhead Press", sets: 3, reps: 8, kg: 40 }, date, date + "T08:20:00.000Z");
};

describe("body model", () => {
  it("has ~60 exercises that all resolve to themselves", () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(60);
    for (const e of EXERCISES) expect(findExercise(e.name)).toBe(e);
    expect(findExercise("Bench Press (Barbell)")?.name).toBe("Bench Press");
    expect(findExercise("Incline Bench Press (Dumbbell)")?.name).toBe("Incline Bench Press");
  });

  it("gains are diminishing: newbies grow fast, plateaus plateau", () => {
    expect(headroom(0)).toBe(1);
    expect(headroom(10)).toBe(0);
    const g0 = sessionGain(1, 4000, 0);
    const g8 = sessionGain(8, 4000, 0);
    expect(g0).toBeGreaterThan(5 * g8);
    expect(sessionGain(3, 8000, 0)).toBeLessThan(2 * sessionGain(3, 4000, 0)); // saturating in volume
    expect(sessionGain(3, 4000, 30000)).toBeLessThan(sessionGain(3, 4000, 0)); // junk volume
  });

  it("a push session raises chest and shoulders, not legs, and moves you to weights", () => {
    const h = fresh();
    push(h, "2026-01-01");
    const [s] = simulate(h, "2026-01-01");
    expect(s.p.chest).toBeGreaterThan(DEFAULT_START.chest + 0.3);
    expect(s.p.shoulders).toBeGreaterThan(DEFAULT_START.shoulders + 0.2);
    expect(s.p.legs).toBe(DEFAULT_START.legs);
    expect(h.days["2026-01-01"].zone).toBe("weights");
    expect(h.days["2026-01-01"].focus).toBe("Push");
    // pump makes it visible same-day on top of the stored gain
    const pumped = withPump(s.p, h.days["2026-01-01"], Date.parse("2026-01-01T08:30:00Z"));
    expect(pumped.chest).toBeGreaterThan(s.p.chest + 0.5);
  });

  it("a year of training plateaus below 10", () => {
    const h = fresh();
    for (let i = 0; i < 365; i += 3) push(h, addDays("2026-01-01", i));
    const series = simulate(h, "2026-12-31");
    const at = (d: number) => series[d].p.chest;
    expect(at(90) - at(0)).toBeGreaterThan(at(364) - at(270));
    expect(at(364)).toBeLessThan(10);
    expect(at(364)).toBeGreaterThan(7);
  });

  it("decays 0.1/day after 7 days without a log", () => {
    const h = fresh();
    push(h, "2026-01-01");
    const s = simulate(h, "2026-01-20");
    expect(s[6].p.chest).toBe(s[1].p.chest);
    expect(s[7].p.chest).toBeCloseTo(s[6].p.chest - 0.1, 5);
    expect(s[19].p.chest).toBeCloseTo(s[6].p.chest - 1.3, 5);
    expect(s[19].sat).toBeLessThan(s[1].sat);
  });

  it("cardio and falling bodyweight cut bodyfat", () => {
    const h = fresh();
    for (let i = 0; i < 30; i++) {
      const d = addDays("2026-01-01", i);
      applyEntry(h, { kind: "cardio", minutes: 40, km: 7 }, d, d + "T07:00:00.000Z");
      applyEntry(h, { kind: "weight", bw: 90 - i * 0.2 }, d, d + "T06:00:00.000Z");
    }
    const s = simulate(h, "2026-01-30");
    expect(s[29].p.bodyfat).toBeLessThan(DEFAULT_START.bodyfat - 1.5);
    expect(h.days["2026-01-30"].zone).toBe("cardio");
  });

  it("flags PRs only when beating a previous best", () => {
    const h = fresh();
    const lift = (kg: number) => applyEntry(h, { kind: "lift", exercise: "Squat", sets: 1, reps: 5, kg }, "2026-01-01", "2026-01-01T08:00:00.000Z");
    expect(lift(100).pr).toBe(false);
    expect(lift(95).pr).toBe(false);
    expect(lift(105).pr).toBe(true);
  });
});

describe("csv parser", () => {
  it("parses quotes and escaped quotes", () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\n1,2,3')).toEqual([["a", "b,c", 'd "e"'], ["1", "2", "3"]]);
  });

  it("parses Hevy and Strong date formats", () => {
    expect(parseDate("3 Nov 2026, 07:30")).toEqual({ date: "2026-11-03", at: "2026-11-03T07:30:00.000Z" });
    expect(parseDate("2026-11-01 09:00:00")?.date).toBe("2026-11-01");
    expect(parseDate("garbage")).toBeNull();
  });

  it("imports the Hevy fixture", () => {
    const r = parseWorkoutCsv(readFileSync("fixtures/hevy-sample.csv", "utf8"));
    expect(r.format).toBe("hevy");
    expect(r.skipped).toBe(1); // warmup
    expect(r.rows.length).toBe(15);
    expect(r.rows[0]).toMatchObject({ date: "2026-11-03", entry: { kind: "lift", exercise: "Bench Press (Barbell)", reps: 8, kg: 70 } });
    expect(r.rows.find((x) => x.entry.kind === "cardio")?.entry).toMatchObject({ minutes: 15, km: 2.5 });

    const h = fresh("2026-11-03");
    for (const row of r.rows) applyEntry(h, row.entry, row.date, row.at);
    expect(Object.keys(h.days).sort()).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(h.days["2026-11-04"].vol.legs).toBeGreaterThan(0);
    expect(h.days["2026-11-04"].cardioMin).toBe(15);
    expect(h.days["2026-11-05"].vol.back).toBeGreaterThan(0);
    expect(h.bests["Bench Press"]).toBe(72.5);
  });

  it("imports a semicolon Strong export with quoted delimiters", () => {
    const r = parseWorkoutCsv(readFileSync("fixtures/strong-sample.csv", "utf8"));
    expect(r.format).toBe("strong");
    expect(r.rows.map((x) => x.entry.kind)).toEqual(["lift", "lift", "cardio"]);
    expect(r.rows[2].entry).toMatchObject({ minutes: 10, km: 2 });
  });
});

describe("floor helpers", () => {
  it("look-alike codes resolve per position (reported 2Q5Y8D -> ZQ5Y8D)", async () => {
    const { codeVariants } = await import("./server/util");
    const v = codeVariants("2Q5Y8D");
    expect(v[0]).toBe("2Q5Y8D");
    expect(v).toContain("ZQ5Y8D");
    expect(v).toContain("ZQSYBD");
    expect(codeVariants("47NWXN")).toEqual(["47NWXN"]);
    expect(codeVariants("ZZZZZ")).toEqual(["ZZZZZ"]); // capped at 16 variants
  });

  it("a cardio finisher keeps a lifting day at its station", () => {
    const h = fresh();
    applyEntry(h, { kind: "lift", exercise: "Squat", sets: 5, reps: 5, kg: 100 }, "2026-01-01", "2026-01-01T08:00:00.000Z");
    applyEntry(h, { kind: "lift", exercise: "Bicep Curl", sets: 1, reps: 10, kg: 10 }, "2026-01-01", "2026-01-01T08:10:00.000Z");
    applyEntry(h, { kind: "cardio", minutes: 10, km: 1.5 }, "2026-01-01", "2026-01-01T08:20:00.000Z");
    expect(h.days["2026-01-01"]).toMatchObject({ zone: "squat", focus: "Legs", cardioMin: 10 });
    const c = fresh();
    applyEntry(c, { kind: "cardio", minutes: 30, km: 5 }, "2026-01-01", "2026-01-01T08:00:00.000Z");
    expect(c.days["2026-01-01"].zone).toBe("cardio");
  });
});

describe("world layout", () => {
  it("every station spot is walkable, reachable from the door, and clear of zone signs", async () => {
    const { SPOTS, SPAWN, SIGNS, findPath, tileOf, walkable } = await import("./world");
    const { textWidth } = await import("./font");
    for (const [zone, spots] of Object.entries(SPOTS)) {
      for (const s of spots) {
        const t = tileOf(s);
        expect(walkable[t.y][t.x], `${zone} spot ${t.x},${t.y} walkable`).toBe(true);
        const path = findPath(SPAWN, s);
        const last = tileOf(path.length > 1 ? path[path.length - 2] : SPAWN);
        expect(Math.abs(last.x - t.x) + Math.abs(last.y - t.y), `${zone} spot ${t.x},${t.y} reachable`).toBeLessThanOrEqual(1);
        // sprite box (feet at s) must not cover a sign board
        for (const [text, cx, y] of SIGNS) {
          const w = textWidth(text) + 8;
          const hit = s.x + 10 > cx - w / 2 && s.x - 10 < cx + w / 2 && s.y > y && s.y - 44 < y + 10;
          expect(hit, `${zone} spot ${t.x},${t.y} covers sign ${text}`).toBe(false);
        }
      }
    }
  });
});

describe("exercise search while typing", () => {
  it("resolves prefixes to the most common lift, only when asked (form typing)", () => {
    const p = { prefix: true };
    expect(findExercise("bench", p)?.name).toBe("Bench Press");
    expect(findExercise("squ", p)?.name).toBe("Squat");
    expect(findExercise("lat p", p)?.name).toBe("Lat Pulldown");
    expect(findExercise("row", p)?.name).toBe("Barbell Row"); // never Rowing (cardio) or Upright Row
    expect(findExercise("rows", p)?.name).toBe("Barbell Row");
    expect(findExercise("press", p)?.name).toBe("Bench Press"); // the typed text wins over its singular
    expect(findExercise("hams", p)?.name).toBe("Leg Curl");
    expect(findExercise("lats", p)?.name).toBe("Lat Pulldown");
    expect(findExercise("front s", p)?.name).toBe("Front Squat");
    expect(findExercise("be", p)).toBeUndefined(); // too short to guess
    expect(findExercise("Mystery Machine 3000", p)).toBeUndefined();
    // server validation and CSV import stay strict
    expect(findExercise("bench")).toBeUndefined();
    expect(findExercise("Lat")).toBeUndefined();
  });
});

describe("csv import dedupe keys", () => {
  const hevy = (unit: "kg" | "lbs", rows: [string, string, number, number][]) =>
    [`"title","start_time","exercise_title","set_index","set_type","weight_${unit}","reps"`, ...rows.map(([t, ex, i, w]) => `"Day","${t}","${ex}","${i}","normal","${w}","5"`)].join("\n");

  it("same sets keep the same keys across kg and lbs exports", () => {
    const kg = parseWorkoutCsv(hevy("kg", [["3 Nov 2026, 07:30", "Bench Press (Barbell)", 0, 61.25], ["3 Nov 2026, 07:30", "Bench Press (Barbell)", 1, 61.25]]));
    const lb = parseWorkoutCsv(hevy("lbs", [["3 Nov 2026, 07:30", "Bench Press (Barbell)", 0, 135.03], ["3 Nov 2026, 07:30", "Bench Press (Barbell)", 1, 135.03]]));
    expect(kg.rows.map((r) => r.key)).toEqual(lb.rows.map((r) => r.key));
    expect(new Set(kg.rows.map((r) => r.key)).size).toBe(2); // two distinct sets
  });

  it("an overlapping newer export only adds the new sets", () => {
    const a = parseWorkoutCsv(readFileSync("fixtures/hevy-sample.csv", "utf8"));
    const b = parseWorkoutCsv(readFileSync("fixtures/hevy-sample.csv", "utf8") + '\n"Extra","6 Nov 2026, 07:00","","","Squat (Barbell)","","","0","normal","100","5","","",""');
    const known = new Set(a.rows.map((r) => r.key));
    expect(b.rows.filter((r) => !known.has(r.key)).map((r) => r.entry)).toEqual([{ kind: "lift", exercise: "Squat (Barbell)", sets: 1, reps: 5, kg: 100 }]);
  });

  it("identical sets without a set index still count separately", () => {
    const csv = "Date;Exercise Name;Weight;Reps\n2026-11-01 09:00:00;Pull Up;0;8\n2026-11-01 09:00:00;Pull Up;0;8";
    const r = parseWorkoutCsv(csv);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].key).not.toBe(r.rows[1].key);
    expect(parseWorkoutCsv(csv).rows.map((x) => x.key)).toEqual(r.rows.map((x) => x.key)); // stable
  });
});

describe("weekly plan", () => {
  // 2026-01-06 is a Tuesday. Plan: Tue push, Thu pull, rest otherwise.
  const plan = ["", "", "PUSH DAY", "", "PULL DAY", "", ""];
  it("rest days don't break the streak, a missed gym day does", () => {
    const h = fresh();
    for (const d of ["2026-01-06", "2026-01-08", "2026-01-13", "2026-01-15"]) push(h, d);
    expect(planFor(plan, "2026-01-06")).toBe("PUSH DAY");
    expect(planFor(plan, "2026-01-07")).toBe("");
    expect(planFor(undefined, "2026-01-07")).toBeNull();
    expect(streak(h.days, "2026-01-18", plan)).toBe(4); // Sunday after: 4 sessions, rest days skipped
    expect(streak(h.days, "2026-01-20", plan)).toBe(4); // gym day today, not done yet
    expect(streak(h.days, "2026-01-21", plan)).toBe(0); // missed Tuesday
    expect(streak(h.days, "2026-01-16")).toBe(1); // without a plan, calendar days: only Thursday counts
  });
});
