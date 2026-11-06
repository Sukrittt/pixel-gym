import type { Entry } from "./body";

/** Minimal RFC4180 parser: quotes, escaped quotes, CRLF, custom delimiter. */
export function parseCsv(text: string, delim = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const key = (h: string) => h.replace(/^﻿/, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Header aliases across Hevy and Strong exports (and a few variants seen in the wild).
const COLS = {
  date: ["starttime", "date", "workoutdate", "start"],
  exercise: ["exercisetitle", "exercisename", "exercise"],
  kg: ["weightkg", "weight", "weightkgs"],
  lbs: ["weightlbs", "weightlb"],
  unit: ["weightunit", "unit"],
  reps: ["reps", "repetitions"],
  km: ["distancekm", "distance"],
  miles: ["distancemiles", "distancemi"],
  seconds: ["durationseconds", "seconds"],
  setType: ["settype"],
} as const;

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** Returns { date: YYYY-MM-DD, at: ISO } or null. Handles ISO, "2024-01-15 07:30:00", "15 Jan 2024, 07:30". */
export function parseDate(s: string): { date: string; at: string } | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const [, y, mo, d, hh = "12", mm = "00"] = m;
    return { date: `${y}-${mo}-${d}`, at: `${y}-${mo}-${d}T${hh.padStart(2, "0")}:${mm}:00.000Z` };
  }
  m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
    const [, d, mon, y, hh = "12", mm = "00"] = m;
    const mo = String(MONTHS[mon.toLowerCase()] + 1).padStart(2, "0");
    const dd = d.padStart(2, "0");
    return { date: `${y}-${mo}-${dd}`, at: `${y}-${mo}-${dd}T${hh.padStart(2, "0")}:${mm}:00.000Z` };
  }
  return null;
}

export type ImportRow = { date: string; at: string; entry: Entry };
export type ImportResult = { rows: ImportRow[]; skipped: number; format: "hevy" | "strong" | "unknown" };

/** Parse a Hevy or Strong CSV export into log entries (one per set). */
export function parseWorkoutCsv(text: string): ImportResult {
  const firstLine = text.split("\n", 1)[0];
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const [header, ...body] = parseCsv(text, delim);
  if (!header) return { rows: [], skipped: 0, format: "unknown" };
  const keys = header.map(key);
  // alias order = priority (Strong has both "Duration" and "Seconds"; Seconds wins)
  const col = (names: readonly string[]) => names.map((n) => keys.indexOf(n)).find((i) => i >= 0) ?? -1;
  const idx = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [k, col(v)])) as Record<keyof typeof COLS, number>;
  const format = keys.includes("exercisetitle") ? "hevy" : keys.includes("exercisename") ? "strong" : "unknown";
  const num = (r: string[], i: number) => (i < 0 ? 0 : parseFloat((r[i] ?? "").replace(",", ".")) || 0);

  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const r of body) {
    const when = idx.date >= 0 ? parseDate(r[idx.date] ?? "") : null;
    const exercise = idx.exercise >= 0 ? (r[idx.exercise] ?? "").trim() : "";
    if (!when || !exercise || (r[idx.setType] ?? "").toLowerCase() === "warmup") {
      skipped++;
      continue;
    }
    let kg = idx.kg >= 0 ? num(r, idx.kg) : num(r, idx.lbs) * 0.4536;
    if (idx.unit >= 0 && /lb/i.test(r[idx.unit] ?? "")) kg *= 0.4536;
    const reps = num(r, idx.reps);
    const km = idx.km >= 0 ? num(r, idx.km) : num(r, idx.miles) * 1.609;
    const secs = num(r, idx.seconds);
    if (reps > 0) {
      rows.push({ ...when, entry: { kind: "lift", exercise, sets: 1, reps, kg: Math.round(kg * 10) / 10 } });
    } else if (secs > 0 || km > 0) {
      rows.push({ ...when, entry: { kind: "cardio", exercise, minutes: Math.round(secs / 6) / 10, km } });
    } else skipped++;
  }
  return { rows, skipped, format };
}
