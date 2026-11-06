"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "@/lib/body";
import { localDate, type EmoteKind, type FloorView } from "@/lib/floor";
import { localEmote } from "./FloorCanvas";
import FloorScreen from "./FloorScreen";

const POLL_MS = 30_000;

/** A real floor: polls every 30s (no websockets in v1). */
export default function LiveFloor({ code }: { code: string }) {
  const [state, setState] = useState<{ view: FloorView; meId: string } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    const load = async () => {
      const r = await fetch(`/api/floors/${code}?today=${localDate()}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) setErr(j.error ?? "Could not load floor.");
      else setState((s) => ({ meId: j.meId, view: { ...j.view, emotes: [...(s?.view.emotes ?? []), ...j.view.emotes].slice(-50) } }));
    };
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    return () => ((live = false), clearTimeout(first), clearInterval(id));
  }, [code]);
  const loadSeries = useCallback(async (id: string): Promise<Snapshot[]> => {
    const r = await fetch(`/api/series?id=${id}&today=${localDate()}`);
    return r.ok ? (await r.json()).series : [];
  }, []);
  const onEmote = (to: string, kind: EmoteKind) => {
    setState((s) => s && { ...s, view: localEmote(s.view, s.meId, to, kind) });
    fetch("/api/emote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to, kind }) });
  };
  if (err) return <p className="err">{err}</p>;
  return (
    <>
      <div className="floor-head">
        <div>
          <h1>{state?.view.name ?? "Loading…"}</h1>
          <span className="muted">Invite code </span>
          <span className="code">{code}</span>
          <span className="muted"> · share it with up to 20 friends</span>
        </div>
        <div className="row">
          <Link className="btn primary" href="/log">+ LOG WORKOUT</Link>
          <Link className="btn" href="/me">MY TIMELAPSE</Link>
        </div>
      </div>
      {state ? <FloorScreen view={state.view} meId={state.meId} onEmote={onEmote} loadSeries={loadSeries} /> : <div className="floor-wrap" style={{ aspectRatio: "640 / 384" }} />}
    </>
  );
}
