"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Param, Snapshot } from "@/lib/body";
import { formatKg, localDate, type Emote, type EmoteKind, type FloorView } from "@/lib/floor";
import { SpriteView } from "./Avatar";
import { localEmote } from "./FloorCanvas";
import FloorScreen from "./FloorScreen";

const POLL_MS = 30_000;
const MAX_TOASTS = 3;
const ZONE_NAME: Record<string, string> = {
  weights: "the free weights", squat: "a squat rack", cardio: "the cardio strip", mat: "the mats",
  bar: "the smoothie bar scale", lockers: "the lockers", outside: "the bench outside",
};
const EMOTE_TEXT: Record<EmoteKind, string> = { bump: "fist-bumped you 👊", flex: "flexed at you 💪", clap: "clapped for you 👏" };

/** Emote ids already toasted, kept across navigations within the tab. */
function seenStore(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem("pg_seen") ?? "[]"));
  } catch {
    return new Set();
  }
}

/** A real floor. First paint comes from the server; then polls every 30s (no websockets in v1). */
export default function LiveFloor({
  code, initial, meId, logged, gain, pr,
}: {
  code: string;
  initial: FloorView;
  meId: string;
  logged: boolean;
  gain: Partial<Record<Param, number>>;
  pr: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [offline, setOffline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGain, setShowGain] = useState(logged);
  const [toasts, setToasts] = useState<{ id: string; text: string; n: number }[]>([]);
  const seen = useRef<Set<string> | null>(null);

  const toast = useCallback((emotes: Emote[], members: FloorView["members"]) => {
    seen.current ??= seenStore();
    const fresh = emotes.filter((e) => e.to === meId && !seen.current!.has(e.id));
    if (!fresh.length) return;
    for (const e of fresh) seen.current.add(e.id);
    try {
      sessionStorage.setItem("pg_seen", JSON.stringify([...seen.current].slice(-200)));
    } catch {}
    // collapse a burst into one line per sender+kind, keep only the newest few
    const groups = new Map<string, { text: string; n: number }>();
    for (const e of fresh) {
      const k = e.from + e.kind;
      const who = members.find((m) => m.id === e.from)?.name ?? "Someone";
      groups.set(k, { text: `${who} ${EMOTE_TEXT[e.kind]}`, n: (groups.get(k)?.n ?? 0) + 1 });
    }
    const id = fresh[fresh.length - 1].id;
    setToasts((ts) => [...ts, ...[...groups.values()].map((g, i) => ({ id: id + i, ...g }))].slice(-MAX_TOASTS));
    setTimeout(() => setToasts((ts) => ts.filter((x) => !x.id.startsWith(id))), 8000);
  }, [meId]);

  useEffect(() => {
    // the "Logged." banner is one-shot: drop ?logged/gain/pr so reload or share doesn't replay it
    if (location.search) history.replaceState(null, "", location.pathname);
  }, []);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/floors/${code}?today=${localDate()}`, { cache: "no-store" });
        if (r.status === 401 || r.status === 403) {
          // session no longer matches this floor (left, or joined another floor in another tab)
          if (live) router.refresh();
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!live) return;
        const v = j.view as FloorView;
        setOffline(false);
        setView((old) => ({ ...v, emotes: [...old.emotes, ...v.emotes].slice(-50) }));
        toast(v.emotes, v.members);
      } catch {
        if (live) setOffline(true);
      }
    };
    void load(); // re-sync with the browser's local date right away
    const id = setInterval(load, POLL_MS);
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      live = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [code, router, toast]);

  const loadSeries = useCallback(async (id: string): Promise<Snapshot[]> => {
    const r = await fetch(`/api/series?id=${id}&today=${localDate()}`);
    return r.ok ? (await r.json()).series : [];
  }, []);
  const onEmote = async (to: string, kind: EmoteKind) => {
    const r = await fetch("/api/emote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to, kind }) }).catch(() => null);
    if (r?.ok) setView((v) => localEmote(v, meId, to, kind));
    return !!r?.ok;
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
  const gains = (Object.entries(gain) as [Param, number][]).filter(([, v]) => Math.abs(v) >= 0.05).sort((a, b) => b[1] - a[1]);
  const before = me && (Object.fromEntries(Object.entries(me.params).map(([k, v]) => [k, v - (gain[k as Param] ?? 0)])) as typeof me.params);

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
        {toasts.map((x) => (
          <div key={x.id} className="toast">
            {x.text}
            {x.n > 1 ? ` ×${x.n}` : ""}
          </div>
        ))}
      </div>

      {offline && <p className="banner warn" role="status">Can&apos;t reach the server. Showing the last known floor, retrying every 30s.</p>}

      {showGain && me && (
        <div className="banner good" role="status">
          {gains.length > 0 && before && (
            <span className="gain-sprites" aria-hidden>
              <SpriteView opts={{ params: before, look: me.look, sat: me.sat }} scale={2} />→
              <SpriteView opts={{ params: me.params, look: me.look, sat: me.sat, glow: pr }} scale={2} />
            </span>
          )}
          <span>
            <b>{pr ? "NEW PR! " : ""}Logged.</b> {t ? `Your avatar is heading to ${ZONE_NAME[t.zone]}.` : "Saved."}
            {gains.length > 0 && <> Today: {gains.map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v.toFixed(1)}`).join(" · ")}.</>}
            {gains.length > 0 && (
              <>
                <br />
                <span style={{ opacity: 0.85 }}>Part of that is today&apos;s pump. It fades over a few hours, and what stays is real progress.</span>
              </>
            )}
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
        <p className="banner plain">
          It&apos;s just you here so far.&nbsp;<button className="link" onClick={copyInvite}>Copy the invite link</button>&nbsp;and send it to your gym friends.
        </p>
      )}
    </>
  );
}
