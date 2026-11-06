"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Param, Snapshot } from "@/lib/body";
import { formatKg, localDate, type EmoteKind, type FloorView } from "@/lib/floor";
import { SpriteView } from "./Avatar";
import { localEmote } from "./FloorCanvas";
import FloorScreen from "./FloorScreen";

const POLL_MS = 30_000;
const ZONE_NAME: Record<string, string> = {
  weights: "the free weights", squat: "a squat rack", cardio: "the cardio strip", mat: "the mats",
  bar: "the smoothie bar scale", lockers: "the lockers", outside: "the bench outside",
};

/** A real floor. First paint comes from the server; then polls every 30s (no websockets in v1). */
export default function LiveFloor({
  code, initial, meId, gain, pr,
}: {
  code: string;
  initial: FloorView;
  meId: string;
  gain: Partial<Record<Param, number>> | null;
  pr: boolean;
}) {
  const [view, setView] = useState(initial);
  const [offline, setOffline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGain, setShowGain] = useState(!!gain);
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/floors/${code}?today=${localDate()}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!live) return;
        setOffline(false);
        setView((v) => ({ ...j.view, emotes: [...v.emotes, ...j.view.emotes].slice(-50) }));
        const fresh = (j.view as FloorView).emotes.filter((e) => e.to === meId && !seen.current.has(e.id));
        for (const e of fresh) {
          seen.current.add(e.id);
          const who = (j.view as FloorView).members.find((m) => m.id === e.from)?.name ?? "Someone";
          const text = e.kind === "bump" ? `${who} fist-bumped you 👊` : e.kind === "flex" ? `${who} flexed at you 💪` : `${who} clapped for you 👏`;
          setToasts((ts) => [...ts, { id: e.id, text }]);
          setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== e.id)), 6000);
        }
      } catch {
        if (live) setOffline(true);
      }
    };
    const first = setTimeout(load, 0); // re-sync with the browser's local date right away
    const id = setInterval(load, POLL_MS);
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      live = false;
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [code, meId]);

  const loadSeries = useCallback(async (id: string): Promise<Snapshot[]> => {
    const r = await fetch(`/api/series?id=${id}&today=${localDate()}`);
    return r.ok ? (await r.json()).series : [];
  }, []);
  const onEmote = (to: string, kind: EmoteKind) => {
    setView((v) => localEmote(v, meId, to, kind));
    fetch("/api/emote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to, kind }) });
  };
  const copyInvite = async () => {
    const url = `${location.origin}/floor/${code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this invite link", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const me = view.members.find((m) => m.id === meId);
  const t = me?.today;
  const gains = gain ? (Object.entries(gain) as [Param, number][]).filter(([, v]) => Math.abs(v) >= 0.05).sort((a, b) => b[1] - a[1]) : [];

  return (
    <>
      <div className="floor-head">
        <div>
          <h1>{view.name}</h1>
          <div className="invite">
            <span className="muted">Invite code</span>
            <span className="code" aria-label={`invite code ${code.split("").join(" ")}`}>{code}</span>
            <button onClick={copyInvite}>{copied ? "COPIED!" : "COPY INVITE LINK"}</button>
            <span className="muted">{view.members.length}/20 lifters</span>
          </div>
        </div>
        <div className="row">
          <Link className="btn primary big" href="/log">+ LOG WORKOUT</Link>
          <Link className="btn" href="/me">MY TIMELAPSE</Link>
        </div>
      </div>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.text}</div>
        ))}
      </div>
      {offline && <p className="banner warn">Can&apos;t reach the server. Showing the last known floor, retrying every 30s.</p>}

      {showGain && (
        <div className="banner good" role="status">
          {me && gains.length > 0 && (
            <span className="gain-sprites" aria-hidden>
              <SpriteView opts={{ params: Object.fromEntries(Object.entries(me.params).map(([k, v]) => [k, v - (gain?.[k as Param] ?? 0)])) as typeof me.params, look: me.look, sat: me.sat }} scale={2} />
              →
              <SpriteView opts={{ params: me.params, look: me.look, sat: me.sat, glow: pr }} scale={2} />
            </span>
          )}
          <span>
            <b>{pr ? "NEW PR! " : ""}Logged.</b> Your avatar is heading to {ZONE_NAME[t?.zone ?? "outside"]}.
            {gains.length > 0 && <> Today: {gains.map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v.toFixed(1)}`).join(" · ")}.</>}
            <br />
            <span style={{ opacity: 0.8 }}>Part of that is today&apos;s pump: it fades over a few hours and what stays is real progress.</span>
          </span>
          <button className="link x" onClick={() => setShowGain(false)} aria-label="dismiss">×</button>
        </div>
      )}

      {me && !t && (
        <div className="banner callout">
          <span>
            <b>You&apos;re on the bench outside, greyed out.</b> Log today&apos;s training and your avatar walks in to the matching station.
          </span>
          <Link className="btn primary" href="/log">LOG TODAY</Link>
        </div>
      )}
      {me && t && !showGain && (
        <p className="banner">
          Today you&apos;re at {ZONE_NAME[t.zone]} · {t.focus}
          {t.total ? ` · ${formatKg(t.total)}` : ""}. Your name tag is gold. Click any avatar to inspect or fist-bump.
        </p>
      )}

      <FloorScreen view={view} meId={meId} onEmote={onEmote} loadSeries={loadSeries} />

      {view.members.length === 1 && (
        <p className="banner">
          It&apos;s just you here. <button className="link" onClick={copyInvite}>Copy the invite link</button> and send it to your gym friends.
        </p>
      )}
    </>
  );
}
