import Link from "next/link";
import JoinForms from "@/components/JoinForms";
import LiveFloor from "@/components/LiveFloor";
import { PARAMS, type Param } from "@/lib/body";
import { floorViewNow } from "@/lib/floor";
import { currentMember, readSession, requestToday } from "@/lib/server/session";
import { readFloor } from "@/lib/server/store";

/** "chest:0.62|legs:0.1" from /log -> validated gains for the banner. */
function parseGain(raw: string | string[] | undefined): Partial<Record<Param, number>> {
  const out: Partial<Record<Param, number>> = {};
  if (typeof raw !== "string") return out;
  for (const part of raw.split("|")) {
    const [k, v] = part.split(":");
    const n = Number(v);
    if ((PARAMS as readonly string[]).includes(k) && Number.isFinite(n) && Math.abs(n) <= 10) out[k as Param] = n;
  }
  return out;
}

export default async function FloorPage({ params, searchParams }: PageProps<"/floor/[code]">) {
  const { code } = await params;
  const q = await searchParams;
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // fresh read: a friend who just joined must never be bounced back to the join form by a cache
  const s = await currentMember(true);
  if (!s || s.doc.code !== c) {
    const sess = await readSession();
    const floor = await readFloor(c, true);
    if (!floor)
      return (
        <div className="panel" style={{ maxWidth: 560 }}>
          <h2>No floor with code {c}</h2>
          <p>Check the invite link with whoever sent it, or start your own floor.</p>
          <Link className="btn primary" href="/">CREATE A FLOOR</Link>
        </div>
      );
    const names = floor.members.map((m) => m.name);
    return (
      <div style={{ maxWidth: 600 }}>
        <h1>{floor.name}</h1>
        <p>
          {names.length === 1 ? `${names[0]} invited you` : `${names.slice(0, 5).join(", ")}${names.length > 5 ? ` and ${names.length - 5} more` : ""} train here`}. Pick a name to step onto the
          floor. Your avatar starts on the bench outside until you log a workout.
        </p>
        {sess?.code === c && <p className="banner warn">We couldn&apos;t find your spot on this floor any more. Joining again creates a new avatar.</p>}
        {sess && sess.code !== c && <p className="muted">You&apos;re on floor {sess.code} now. Joining here moves you to this floor.</p>}
        <JoinForms code={c} />
      </div>
    );
  }
  // Server-rendered first paint in the visitor's local date: the floor never waits on a client fetch.
  const initial = floorViewNow(s.doc, await requestToday());
  return <LiveFloor code={c} initial={initial} meId={s.me.id} logged={q.logged === "1"} gain={parseGain(q.gain)} pr={q.pr === "1"} />;
}
