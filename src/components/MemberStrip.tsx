"use client";
import type { MemberView } from "@/lib/floor";
import { SpriteView } from "./Avatar";

/** Who you'd be training with: a row of the floor's avatars (invite page). */
export default function MemberStrip({ members }: { members: MemberView[] }) {
  return (
    <ul className="strip" aria-label="lifters on this floor">
      {members.slice(0, 8).map((m) => (
        <li key={m.id}>
          <SpriteView opts={{ params: m.params, look: m.look, sat: m.sat, grey: !m.today }} scale={2} label={m.name} />
          <span>{m.name}</span>
        </li>
      ))}
    </ul>
  );
}
