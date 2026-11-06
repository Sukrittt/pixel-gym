"use client";
import { useCallback, useState } from "react";
import type { Snapshot } from "@/lib/body";
import type { EmoteKind, FloorView, MemberView } from "@/lib/floor";
import { InspectCard } from "./Avatar";
import FloorCanvas from "./FloorCanvas";

/** Floor canvas + click-to-inspect card. Works for demo and real floors. */
export default function FloorScreen({
  view, meId, onEmote, loadSeries,
}: {
  view: FloorView;
  meId?: string;
  onEmote?: (to: string, k: EmoteKind) => Promise<number> | void;
  loadSeries: (id: string) => Promise<Snapshot[]>;
}) {
  const [sel, setSel] = useState<MemberView | null>(null);
  const selId = sel?.id;
  const load = useCallback(() => (selId ? loadSeries(selId) : Promise.resolve([])), [selId, loadSeries]);
  const close = useCallback(() => setSel(null), []);
  const fresh = sel && (view.members.find((m) => m.id === sel.id) ?? sel);
  return (
    <>
      <FloorCanvas view={view} meId={meId} onSelect={setSel} />
      <ul className="roster" aria-label="lifters on this floor">
        {view.members.map((m) => (
          <li key={m.id}>
            <button className={m.id === meId ? "me" : m.today ? "" : "off"} onClick={() => setSel(m)}>
              {m.id === meId ? "★ " : ""}
              {m.name} · {m.today ? m.today.focus : "off today"}
            </button>
          </li>
        ))}
      </ul>
      <p className="muted">Click or tap any avatar (or a name above) to inspect their body, send an emote, or scrub their timelapse.</p>
      {fresh && (
        <InspectCard
          m={fresh}
          isMe={fresh.id === meId}
          floorName={view.name}
          onClose={close}
          onEmote={onEmote && ((k) => onEmote(fresh.id, k))}
          loadSeries={load}
        />
      )}
    </>
  );
}
