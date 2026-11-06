"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { addDays, type Snapshot } from "@/lib/body";
import { formatKg, localDate, type MemberView } from "@/lib/floor";
import { downloadCard, ParamBars, SpriteView, Timelapse } from "./Avatar";

type Day = { date: string; focus: string; total: number; sets: number; cardioMin: number; km: number; bw?: number; pr: boolean };
type Me = { code: string; floorName: string; me: MemberView; series: Snapshot[]; days: Day[] };

export default function MeView() {
  const [data, setData] = useState<Me | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`/api/me?today=${localDate()}`)
      .then(async (r) => (r.ok ? setData(await r.json()) : setErr((await r.json()).error)))
      .catch(() => setErr("Could not load."));
  }, []);
  if (err) return <p className="err">{err}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const { me, series, days } = data;
  const byDate = new Map(days.map((d) => [d.date, d]));
  const today = localDate();
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
          <h3>TODAY</h3>
          <div className="tl-stage">
            <SpriteView opts={{ params: me.params, look: me.look, sat: me.sat }} scale={4} label="you today" />
            <ParamBars p={me.params} compare={me.snaps.day1.p} />
          </div>
          <h3>LAST 120 DAYS</h3>
          <div className="heat" aria-label="training heatmap">
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
                    {d.total ? formatKg(d.total) : ""}
                    {d.cardioMin ? ` ${d.cardioMin} min` : ""}
                    {d.bw ? ` ${d.bw} kg bw` : ""}
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
          <p className="muted">Scrub or press play to replay your body day by day since day one.</p>
          <Timelapse series={series} look={me.look} />
        </div>
      </div>
    </>
  );
}
