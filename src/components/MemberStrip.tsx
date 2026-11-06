"use client";
import type { Params } from "@/lib/body";
import type { Look } from "@/lib/sprite";
import { SpriteView } from "./Avatar";

export type StripMember = { id: string; name: string; look: Look; params: Params; sat: number; active: boolean };

/** Who you'd be training with: a row of the floor's avatars (invite page). */
export default function MemberStrip({ members, more }: { members: StripMember[]; more: number }) {
  return (
    <ul className="strip" aria-label="lifters on this floor">
      {members.map((m) => (
        <li key={m.id}>
          <SpriteView opts={{ params: m.params, look: m.look, sat: m.sat, grey: !m.active }} scale={2} label={m.name} />
          <span>{m.name}</span>
        </li>
      ))}
      {more > 0 && <li className="more">+{more}</li>}
    </ul>
  );
}
