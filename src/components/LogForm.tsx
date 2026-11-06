"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Entry } from "@/lib/body";
import { EXERCISES, findExercise } from "@/lib/exercises";
import { localDate } from "@/lib/floor";

const LIFTS = EXERCISES.filter((e) => !e.cardio);
const CARDIO = EXERCISES.filter((e) => e.cardio);
type Lift = Extract<Entry, { kind: "lift" }>;
/** An editable row: numbers stay strings while typing so clearing a field doesn't snap to 0. */
type Row = { exercise: string; sets: string; reps: string; kg: string };
const LIMITS = { sets: 30, reps: 200, kg: 700 } as const;
const toRow = (l: Lift): Row => ({ exercise: l.exercise, sets: String(l.sets), reps: String(l.reps), kg: String(l.kg) });
const clampNum = (v: string, max: number, min = 0) => Math.min(max, Math.max(min, Number(v) || 0));
const toLift = (r: Row): Lift => lift(r.exercise, clampNum(r.sets, LIMITS.sets, 1), clampNum(r.reps, LIMITS.reps, 1), clampNum(r.kg, LIMITS.kg));

const lift = (exercise: string, sets: number, reps: number, kg: number): Lift => ({ kind: "lift", exercise, sets, reps, kg });
const TEMPLATES: Record<string, Lift[]> = {
  "PUSH DAY": [lift("Bench Press", 4, 8, 60), lift("Overhead Press", 3, 8, 35), lift("Lateral Raise", 3, 15, 8), lift("Tricep Pushdown", 3, 12, 25)],
  "PULL DAY": [lift("Pull Up", 4, 8, 0), lift("Barbell Row", 3, 10, 50), lift("Lat Pulldown", 3, 12, 45), lift("Bicep Curl", 3, 12, 12)],
  "LEG DAY": [lift("Squat", 5, 5, 80), lift("Romanian Deadlift", 3, 8, 60), lift("Leg Press", 3, 12, 120), lift("Calf Raise", 3, 15, 40)],
  ARMS: [lift("Bicep Curl", 3, 12, 12), lift("Hammer Curl", 3, 12, 12), lift("Skull Crusher", 3, 10, 25), lift("Tricep Pushdown", 3, 12, 25)],
  CORE: [lift("Plank", 3, 1, 0), lift("Hanging Leg Raise", 3, 12, 0), lift("Crunch", 3, 20, 0)],
};

/** Tiny stable string hash (FNV-1a) for the idempotency key. */
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
};

const muscles = (name: string) => {
  const ex = findExercise(name);
  if (!ex) return "";
  return Object.entries(ex.m)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .join(" · ");
};

export default function LogForm({ code, loggedToday }: { code: string; loggedToday: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState({ exercise: "", sets: "3", reps: "8", kg: "" });
  const [cardio, setCardio] = useState({ exercise: "Running", minutes: "", km: "" });
  const [bw, setBw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [imp, setImp] = useState("");
  const [note, setNote] = useState("");
  // per-visit nonce; the log id = nonce + hash of the exact payload, so an identical retry
  // (lost response, double tap) dedupes server-side and any change is a new submission
  const [nonce] = useState(() => Math.random().toString(36).slice(2, 10));
  const [bwInvalid, setBwInvalid] = useState(false);
  const bwRef = useRef<HTMLInputElement>(null);
  // any edit clears a stale validation message and starts a new submission
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    setMsg("");
    setBwInvalid(false);
    set(v);
  };
  const setRowsT = touch(setRows);
  const setCardioT = touch(setCardio);
  const setBwT = touch(setBw);

  /** The draft row as an entry, or null if empty / unknown. */
  const draftEntry = (): Lift | null | "unknown" => {
    if (!draft.exercise.trim()) return null;
    const ex = findExercise(draft.exercise, { prefix: true });
    if (!ex || ex.cardio) return "unknown";
    return toLift({ ...draft, exercise: ex.name });
  };

  const addDraft = (e?: React.FormEvent) => {
    e?.preventDefault();
    const d = draftEntry();
    const ex = findExercise(draft.exercise) ?? findExercise(draft.exercise, { prefix: true });
    if (ex?.cardio) {
      // typed "running" in the lift box: move it to the cardio row instead of erroring
      setCardio((c) => ({ ...c, exercise: ex.name }));
      setDraft((x) => ({ ...x, exercise: "" }));
      return setMsg(`${ex.name} is cardio: set its minutes in the cardio row below.`);
    }
    if (d === "unknown") return setMsg(`Don't know "${draft.exercise}". Pick one from the suggestions.`);
    if (!d) return setMsg("Type an exercise first.");
    setMsg("");
    setRows((v) => [...v, toRow(d)]);
    setDraft((x) => ({ ...x, exercise: "" }));
  };

  const edit = (i: number, k: "sets" | "reps" | "kg", v: string) => setRowsT(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const save = async (rest = false) => {
    let list: Entry[] = [];
    if (rest) list = [{ kind: "rest" }];
    else {
      const d = draftEntry();
      if (d === "unknown") return setMsg(`Don't know "${draft.exercise}". Pick one from the suggestions or clear it.`);
      list = [...rows.map(toLift), ...(d ? [d] : [])];
      if (+cardio.minutes > 0) list.push({ kind: "cardio", exercise: cardio.exercise, minutes: clampNum(cardio.minutes, 600, 1), km: clampNum(cardio.km, 300) });
      if (bw.trim()) {
        if (+bw < 25 || +bw > 350) {
          setBwInvalid(true);
          bwRef.current?.focus();
          return setMsg("Bodyweight should be between 25 and 350 kg.");
        }
        list.push({ kind: "weight", bw: +bw });
      }
    }
    if (!list.length) return setMsg("Add a lift, some cardio or your bodyweight first. Or tap a template above.");
    setBusy(true);
    setMsg("");
    try {
      const logId = nonce + hash(JSON.stringify(list));
      const r = await fetch("/api/log", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entries: list, today: localDate(), logId }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Could not save.");
      // duplicate = this exact submission already landed (lost response): still go see it
      const gain = Object.entries(j.gains ?? {})
        .filter(([, v]) => Math.abs(v as number) >= 0.05)
        .map(([k, v]) => `${k}:${v}`)
        .join("|");
      router.push(`/floor/${j.code ?? code}?logged=1&gain=${encodeURIComponent(gain)}${j.pr ? "&pr=1" : ""}`);
    } catch (x) {
      setBusy(false);
      setMsg(x instanceof TypeError ? "Network error: check your connection and try again." : (x as Error).message || "Could not save.");
    }
  };

  const importCsv = async (file: File) => {
    setImp("Importing…");
    try {
      const r = await fetch("/api/import", { method: "POST", body: await file.text() });
      const j = await r.json().catch(() => ({}));
      setImp(
        r.ok && j.sets === 0
          ? `Nothing new: all ${j.alreadyImported} sets in this file were already imported.`
          : r.ok
          ? `Imported ${j.sets} sets over ${j.days} days from ${j.format}${j.alreadyImported ? ` (${j.alreadyImported} already-imported sets skipped)` : ""}${j.skipped ? `, ${j.skipped} rows not recognised` : ""}. Open your floor to see the new you.`
          : j.error ?? "Import failed.",
      );
    } catch {
      setImp("Import failed: network error.");
    }
  };

  const pending = draftEntry();

  return (
    <div className="grid2">
      <div className="panel">
        {loggedToday && (
          <p className="banner callout" style={{ color: "#fff4d6" }}>
            Already logged today: {loggedToday}. Anything you save now is added to today.
          </p>
        )}
        <h3>START FROM A TEMPLATE</h3>
        <div className="lab-row" style={{ marginTop: 0 }}>
          {Object.keys(TEMPLATES).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                const have = new Set(rows.map((r) => r.exercise));
                const add = TEMPLATES[k].filter((l) => !have.has(l.exercise));
                setRowsT([...rows, ...add.map(toRow)]);
                const dup = TEMPLATES[k].length - add.length;
                if (dup) setNote(`${dup} ${dup === 1 ? "exercise was" : "exercises were"} already in your list, so ${dup === 1 ? "it was" : "they were"} kept as is.`);
              }}
            >
              {k}
            </button>
          ))}
        </div>
        <p className="muted" role="status">{note || "Adds that workout to your list. Then tweak the numbers to what you actually did."}</p>

        <form onSubmit={addDraft}>
          <h3>ADD A LIFT</h3>
          <div className="row">
            <label style={{ flex: "3 1 200px" }}>
              EXERCISE
              <input list="exercises" value={draft.exercise} onChange={(e) => (setMsg(""), setDraft({ ...draft, exercise: e.target.value }))} placeholder="e.g. bench, squat, curl" />
            </label>
            <label>
              SETS
              <input type="number" inputMode="numeric" min={1} max={30} value={draft.sets} onChange={(e) => setDraft({ ...draft, sets: e.target.value })} />
            </label>
            <label>
              REPS
              <input type="number" inputMode="numeric" min={1} max={200} value={draft.reps} onChange={(e) => setDraft({ ...draft, reps: e.target.value })} />
            </label>
            <label>
              KG
              <input type="number" inputMode="decimal" min={0} max={700} step={0.5} value={draft.kg} onChange={(e) => setDraft({ ...draft, kg: e.target.value })} placeholder="BW" title="leave empty or 0 for bodyweight exercises" />
            </label>
          </div>
          <datalist id="exercises">
            {LIFTS.map((e) => (
              <option key={e.name} value={e.name} />
            ))}
          </datalist>
          <p className="row" style={{ alignItems: "center" }}>
            <button style={{ flex: "0 0 auto" }}>+ ADD</button>
            <span className="muted">
              {pending && pending !== "unknown"
                ? `→ ${pending.exercise} · works ${muscles(pending.exercise)}`
                : pending === "unknown"
                  ? findExercise(draft.exercise)?.cardio
                    ? "that's cardio: press ADD to move it to the cardio row"
                    : "not in the exercise list"
                  : ""}
            </span>
          </p>
        </form>

        {rows.length > 0 && (
          <>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ flex: "0 0 auto" }}>TODAY&apos;S LIST ({rows.length})</h3>
            <button type="button" className="link" style={{ flex: "0 0 auto" }} onClick={() => setRowsT([])}>clear all</button>
          </div>
          <table className="sets">
            <thead>
              <tr>
                <th>EXERCISE</th>
                <th>SETS</th>
                <th>REPS</th>
                <th>KG</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    {r.exercise}
                    <div className="muted">{muscles(r.exercise)}</div>
                  </td>
                  {(["sets", "reps", "kg"] as const).map((k) => (
                    <td key={k}>
                      <input type="number" inputMode="decimal" min={k === "kg" ? 0 : 1} max={LIMITS[k]} step={k === "kg" ? 0.5 : 1} value={r[k]} placeholder={k === "kg" ? "BW" : ""} onChange={(e) => edit(i, k, e.target.value)} aria-label={`${r.exercise} ${k}`} />
                    </td>
                  ))}
                  <td>
                    <button type="button" onClick={() => setRowsT(rows.filter((_, j) => j !== i))} aria-label={`remove ${r.exercise}`}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}

        <h3>CARDIO &amp; BODYWEIGHT (OPTIONAL)</h3>
        <div className="row">
          <label>
            TYPE
            <select value={cardio.exercise} onChange={(e) => setCardioT({ ...cardio, exercise: e.target.value })}>
              {CARDIO.map((e) => (
                <option key={e.name}>{e.name}</option>
              ))}
            </select>
          </label>
          <label>
            MINUTES
            <input type="number" inputMode="numeric" min={0} value={cardio.minutes} onChange={(e) => setCardioT({ ...cardio, minutes: e.target.value })} />
          </label>
          <label>
            KM
            <input type="number" inputMode="decimal" min={0} step={0.1} value={cardio.km} onChange={(e) => setCardioT({ ...cardio, km: e.target.value })} />
          </label>
          <label>
            BODYWEIGHT KG
            <input ref={bwRef} type="number" inputMode="decimal" min={25} max={350} step={0.1} value={bw} onChange={(e) => setBwT(e.target.value)} aria-invalid={bwInvalid} aria-describedby={bwInvalid ? "log-msg" : undefined} className={bwInvalid ? "invalid" : ""} />
          </label>
        </div>
        <div className="actions">
          <button className="primary big" disabled={busy} onClick={() => save()}>
            {busy ? "SAVING…" : "SAVE & GO TO FLOOR"}
          </button>
          <button disabled={busy} onClick={() => save(true)}>
            LOG REST DAY
          </button>
        </div>
        {msg && (
          <p className="err" role="alert" id="log-msg">
            {msg}
          </p>
        )}
      </div>
      <div className="panel">
        <h3>IMPORT FROM HEVY / STRONG</h3>
        <p className="muted">
          Export your workouts as CSV from Hevy (Profile → Settings → Export data) or Strong (Settings → Export strong data), then pick the file. Your whole history replays into your body.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} aria-label="CSV file" />
        {imp && <p role="status">{imp}</p>}
        <h3>HOW IT GROWS</h3>
        <ul className="muted">
          <li>Every set adds volume (sets × reps × kg) to the muscles it works.</li>
          <li>Push days grow chest and shoulders, pull days your back, squats and deadlifts your legs, curls and pushdowns your arms.</li>
          <li>Cardio and a falling bodyweight trend cut bodyfat.</li>
          <li>Beginners grow fast, then it plateaus. A week off and everything starts to shrink.</li>
          <li>You get a pump right after a session, so the change shows up on the floor straight away.</li>
        </ul>
      </div>
    </div>
  );
}
