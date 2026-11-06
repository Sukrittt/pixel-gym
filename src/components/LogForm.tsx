"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Entry } from "@/lib/body";
import { EXERCISES, findExercise } from "@/lib/exercises";
import { localDate } from "@/lib/floor";

const LIFTS = EXERCISES.filter((e) => !e.cardio);
const CARDIO = EXERCISES.filter((e) => e.cardio);

const label = (e: Entry) =>
  e.kind === "lift" ? `${e.exercise} · ${e.sets}×${e.reps} @ ${e.kg || "BW"}${e.kg ? " kg" : ""}`
  : e.kind === "cardio" ? `${e.exercise ?? "Cardio"} · ${e.minutes} min${e.km ? ` · ${e.km} km` : ""}`
  : e.kind === "weight" ? `Bodyweight ${e.bw} kg` : "Rest day";

export default function LogForm({ code }: { code: string }) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [lift, setLift] = useState({ exercise: "", sets: "3", reps: "8", kg: "" });
  const [cardio, setCardio] = useState({ exercise: "Running", minutes: "", km: "" });
  const [bw, setBw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [imp, setImp] = useState("");

  const addLift = (e: React.FormEvent) => {
    e.preventDefault();
    const ex = findExercise(lift.exercise);
    if (!ex || ex.cardio) return setMsg(`Don't know "${lift.exercise}". Pick one from the list.`);
    setMsg("");
    setEntries((v) => [...v, { kind: "lift", exercise: ex.name, sets: +lift.sets || 1, reps: +lift.reps || 1, kg: +lift.kg || 0 }]);
    setLift((l) => ({ ...l, exercise: "" }));
  };

  const all = (): Entry[] => {
    const out = [...entries];
    if (+cardio.minutes > 0) out.push({ kind: "cardio", exercise: cardio.exercise, minutes: +cardio.minutes, km: +cardio.km || 0 });
    if (+bw > 0) out.push({ kind: "weight", bw: +bw });
    return out;
  };

  const save = async (list: Entry[]) => {
    if (!list.length) return setMsg("Add at least one thing.");
    setBusy(true);
    const r = await fetch("/api/log", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entries: list, today: localDate() }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setBusy(false);
      return setMsg(j.error ?? "Could not save.");
    }
    router.push(`/floor/${code}${j.pr ? "?pr=1" : ""}`);
  };

  const importCsv = async (file: File) => {
    setImp("Importing…");
    const r = await fetch("/api/import", { method: "POST", body: await file.text() });
    const j = await r.json().catch(() => ({}));
    setImp(r.ok ? `Imported ${j.sets} sets over ${j.days} days from ${j.format} (${j.skipped} rows skipped).` : j.error ?? "Import failed.");
  };

  return (
    <div className="grid2">
      <div className="panel">
        <form onSubmit={addLift}>
          <h3>LIFT</h3>
          <div className="row">
            <label style={{ flex: "3 1 200px" }}>
              EXERCISE
              <input list="exercises" value={lift.exercise} onChange={(e) => setLift({ ...lift, exercise: e.target.value })} placeholder="Bench Press" autoFocus />
            </label>
            <label>
              SETS
              <input type="number" min={1} max={30} value={lift.sets} onChange={(e) => setLift({ ...lift, sets: e.target.value })} />
            </label>
            <label>
              REPS
              <input type="number" min={1} max={200} value={lift.reps} onChange={(e) => setLift({ ...lift, reps: e.target.value })} />
            </label>
            <label>
              KG
              <input type="number" min={0} max={700} step={0.5} value={lift.kg} onChange={(e) => setLift({ ...lift, kg: e.target.value })} placeholder="BW" />
            </label>
          </div>
          <datalist id="exercises">
            {LIFTS.map((e) => (
              <option key={e.name} value={e.name} />
            ))}
          </datalist>
          <p>
            <button>+ ADD</button>
          </p>
        </form>
        <ul className="entries">
          {entries.map((e, i) => (
            <li key={i}>
              {label(e)}
              <button onClick={() => setEntries((v) => v.filter((_, j) => j !== i))} aria-label="remove">×</button>
            </li>
          ))}
        </ul>
        <h3>CARDIO (OPTIONAL)</h3>
        <div className="row">
          <label>
            TYPE
            <select value={cardio.exercise} onChange={(e) => setCardio({ ...cardio, exercise: e.target.value })}>
              {CARDIO.map((e) => (
                <option key={e.name}>{e.name}</option>
              ))}
            </select>
          </label>
          <label>
            MINUTES
            <input type="number" min={0} value={cardio.minutes} onChange={(e) => setCardio({ ...cardio, minutes: e.target.value })} />
          </label>
          <label>
            KM
            <input type="number" min={0} step={0.1} value={cardio.km} onChange={(e) => setCardio({ ...cardio, km: e.target.value })} />
          </label>
        </div>
        <h3>BODYWEIGHT (OPTIONAL)</h3>
        <label style={{ maxWidth: 160 }}>
          KG
          <input type="number" min={25} max={350} step={0.1} value={bw} onChange={(e) => setBw(e.target.value)} />
        </label>
        <div className="actions">
          <button className="primary" disabled={busy} onClick={() => save(all())}>SAVE & GO TO FLOOR</button>
          <button disabled={busy} onClick={() => save([{ kind: "rest" }])}>LOG REST DAY</button>
          {msg && <span className="err">{msg}</span>}
        </div>
      </div>
      <div className="panel">
        <h3>IMPORT FROM HEVY / STRONG</h3>
        <p className="muted">Export your workouts as CSV from Hevy (Settings → Export) or Strong (Settings → Export data), then drop the file here. Your whole history replays into your body.</p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
        {imp && <p>{imp}</p>}
        <h3>HOW IT GROWS</h3>
        <p className="muted">
          Each set adds volume (sets × reps × kg) to muscle groups. Push work grows chest and shoulders, pulls grow your
          back, squats and deadlifts grow legs, cardio and a falling bodyweight trend cut bodyfat. Gains are fast at first and
          plateau later. Seven days without a log and everything starts to shrink.
        </p>
      </div>
    </div>
  );
}
