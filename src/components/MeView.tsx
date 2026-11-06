"use client";
import Link from "next/link";
import { useState } from "react";
import { addDays } from "@/lib/body";
import { formatKg, type MeData } from "@/lib/floor";
import { LOOK_MAX } from "@/lib/sprite";
import { PLAN_SLOTS } from "@/lib/templates";

const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const slotName = (s: string) => (s === "" ? "Rest" : s === "GYM" ? "Gym (any workout)" : s.charAt(0) + s.slice(1).toLowerCase());
import { downloadCard, ParamBars, SpriteView, Timelapse } from "./Avatar";

export default function MeView({ initial }: { initial: MeData }) {
  const [data, setData] = useState(initial);
  const [lookMsg, setLookMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const setLook = async (k: keyof typeof LOOK_MAX) => {
    if (saving) return; // ignore rapid repeats without disabling (keeps keyboard focus)
    const prev = data.me.look;
    const look = { ...prev, [k]: (prev[k] + 1) % LOOK_MAX[k] };
    setData((d) => ({ ...d, me: { ...d.me, look } })); // optimistic
    setSaving(true);
    setLookMsg("");
    const r = await fetch("/api/look", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ look }), signal: AbortSignal.timeout(10_000) }).catch(() => null);
    setSaving(false);
    if (!r?.ok) {
      setData((d) => ({ ...d, me: { ...d.me, look: prev } })); // roll back
      setLookMsg("Couldn't save your look. Check your connection and try again.");
    }
  };
  const [plan, setPlan] = useState(() => initial.me.plan ?? Array<string>(7).fill(""));
  const [planMsg, setPlanMsg] = useState("");
  const savePlan = async (i: number, v: string) => {
    const prev = plan;
    const next = plan.map((x, j) => (j === i ? v : x));
    setPlan(next); // optimistic
    setPlanMsg("");
    const r = await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: next }), signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (r?.ok) setPlanMsg(`Saved: ${DAY_NAMES[i]} is ${v === "" ? "a rest day" : `${slotName(v).toLowerCase()}`}.`);
    else {
      setPlan(prev);
      setPlanMsg("Couldn't save your plan. Check your connection and try again.");
    }
  };
  const { me, series, days } = data;
  const byDate = new Map(days.map((d) => [d.date, d]));
  const today = series[series.length - 1]?.date ?? days[0]?.date;
  const active = Array.from({ length: 120 }, (_, i) => addDays(today, i - 119)).filter((d) => byDate.has(d)).length;
  return (
    <>
      <div className="floor-head">
        <div>
          <h1>{me.name}</h1>
          <span className="muted">
            {data.floorName} · streak {me.streak}d · this week {formatKg(me.weekly)}
          </span>
        </div>
        <div className="row">
          <Link className="btn primary" href="/log">+ LOG</Link>
          <Link className="btn" href={`/floor/${data.code}`}>FLOOR</Link>
          <button onClick={() => downloadCard(me, data.floorName)}>⬇ SHARE CARD</button>

        </div>
      </div>
      <div className="grid2">
        <div className="panel">
          <h3>TODAY{me.today && me.today.sets > 0 ? " (INCL. TODAY'S PUMP)" : ""}</h3>
          <div className="tl-stage">
            <SpriteView opts={{ params: me.params, look: me.look, sat: me.sat }} scale={4} label="you today" />
            <ParamBars p={me.params} compare={me.snaps.day1.p} />
          </div>
          <h3>YOUR GYM WEEK</h3>
          <p className="muted">
            Pick the days you train. On a gym day the log opens with that workout filled in. Rest days don&apos;t break your streak, and your avatar chills at the lockers
            instead of sitting greyed outside.
          </p>
          <div className="week">
            {WEEK.map((i) => (
              <label key={i}>
                {DAY_NAMES[i].slice(0, 3).toUpperCase()}
                <select value={plan[i]} onChange={(e) => savePlan(i, e.target.value)} className={plan[i] ? "on" : ""} aria-label={`${DAY_NAMES[i]} plan`}>
                  {PLAN_SLOTS.map((s) => (
                    <option key={s} value={s}>{slotName(s)}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {planMsg && <p className={planMsg.startsWith("Saved") ? "muted" : "err"} role="status">{planMsg}</p>}
          <h3>YOUR LOOK</h3>
          <div className="lab-row" style={{ marginTop: 0 }}>
            {(["skin", "hair", "hairColor", "shirt", "shorts"] as const).map((k) => (
              <button key={k} onClick={() => setLook(k)} aria-busy={saving} aria-label={`change ${k === "hairColor" ? "hair color" : k}, currently ${me.look[k] + 1} of ${LOOK_MAX[k]}`}>
                {k === "hairColor" ? "hair color" : k} {me.look[k] + 1}/{LOOK_MAX[k]} ↻
              </button>
            ))}
          </div>
          {lookMsg && <p className="err" role="alert">{lookMsg}</p>}
          <h3>LAST 120 DAYS</h3>
          <p className="muted">
            {active} training {active === 1 ? "day" : "days"} in the last 120.
          </p>
          <div className="heat" aria-hidden>
            {Array.from({ length: 120 }, (_, i) => addDays(today, i - 119)).map((d) => {
              const x = byDate.get(d);
              const v = x ? Math.min(1, x.total / 15000 + (x.cardioMin ? 0.4 : 0)) : 0;
              return <i key={d} title={`${d}${x ? ` · ${x.focus}` : ""}`} style={{ background: v ? `rgba(63,163,107,${0.3 + v * 0.7})` : undefined }} />;
            })}
          </div>
          <h3>TIMELINE</h3>
          {days.length ? (
            <ul className="days">
              {days.slice(0, 200).map((d) => (
                <li key={d.date}>
                  <span>{d.date}</span>
                  <span>
                    {d.focus}
                    {d.pr ? " · PR!" : ""}
                  </span>
                  <span className="muted">
                    {[d.total ? formatKg(d.total) : "", d.cardioMin ? `${d.cardioMin} min cardio${d.km ? ` · ${d.km} km` : ""}` : "", d.bw ? `${d.bw} kg bw` : ""].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing logged yet.</p>
          )}
        </div>
        <div className="panel">
          <h3>TIMELAPSE</h3>
          {series.length > 1 && <p className="muted">Scrub or press play to replay your body day by day since day one.</p>}
          <Timelapse series={series} look={me.look} />
        </div>
      </div>
    </>
  );
}
