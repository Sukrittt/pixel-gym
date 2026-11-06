import JoinForms from "@/components/JoinForms";
import MemberStrip from "@/components/MemberStrip";
import LiveFloor from "@/components/LiveFloor";
import { PARAMS, type Param } from "@/lib/body";
import { floorViewNow, memberViewsNow } from "@/lib/floor";
import { currentMember, readSession, requestToday } from "@/lib/server/session";
import { readFloor, resolveCode } from "@/lib/server/store";
import { notFound, redirect } from "next/navigation";

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


export async function generateMetadata({ params }: PageProps<"/floor/[code]">) {
  const { code } = await params;
  // title from the 10s memo read; the page body below does the fresh read
  const floor = await readFloor(code.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  return { title: floor ? `${floor.name} · Pixel Gym` : "Not found · Pixel Gym" };
}

/** "A, B and C" / "A, B, C, D, E and 3 more" */
function list(names: string[]) {
  const shown = names.slice(0, 5);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown[0];
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
    if (!floor) {
      // hand-typed look-alike (2Q5Y8D for ZQ5Y8D): send them to the real floor
      const real = await resolveCode(c, true);
      if (real && real !== c) redirect(`/floor/${real}`);
      notFound();
    }
    const names = floor.members.map((m) => m.name);
    return (
      <div style={{ maxWidth: 980 }}>
        <h1>{floor.name}</h1>
        <p>
          {names.length === 1 ? `${names[0]} invited you` : `${list(names)} train here`}. Pick a name to step onto the
          floor. Your avatar starts on the bench outside until you log a workout.
        </p>
        {sess?.code === c && <p className="banner warn">We couldn&apos;t find your spot on this floor any more. Joining again creates a new avatar.</p>}
        {sess && sess.code !== c && <p className="muted">You&apos;re signed in on another floor. Joining here moves you to this one.</p>}
        <div className="join-grid">
          <JoinForms code={c} />
          {/* only what the strip draws: no volumes, weigh-ins or history for anonymous visitors */}
          <MemberStrip
            members={memberViewsNow(floor.members.slice(0, 8), await requestToday()).map((m) => ({ id: m.id, name: m.name, look: m.look, params: m.params, sat: m.sat, active: !!m.today }))}
            more={Math.max(0, floor.members.length - 8)}
          />
        </div>
      </div>
    );
  }
  // Server-rendered first paint in the visitor's local date: the floor never waits on a client fetch.
  const initial = floorViewNow(s.doc, await requestToday());
  return <LiveFloor code={c} initial={initial} meId={s.me.id} logged={q.logged === "1"} gain={parseGain(q.gain)} pr={q.pr === "1"} />;
}
