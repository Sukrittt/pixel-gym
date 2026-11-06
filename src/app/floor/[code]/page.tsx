import JoinForms from "@/components/JoinForms";
import LiveFloor from "@/components/LiveFloor";
import { PARAMS, type Param } from "@/lib/body";
import { floorViewNow, safeToday } from "@/lib/floor";
import { currentMember } from "@/lib/server/session";

/** "chest:0.62|legs:0.1" from /log -> validated gains for the banner. */
function parseGain(raw: string | string[] | undefined): Partial<Record<Param, number>> | null {
  if (typeof raw !== "string") return null;
  const out: Partial<Record<Param, number>> = {};
  for (const part of raw.split("|")) {
    const [k, v] = part.split(":");
    const n = Number(v);
    if ((PARAMS as readonly string[]).includes(k) && Number.isFinite(n) && Math.abs(n) <= 10) out[k as Param] = n;
  }
  return Object.keys(out).length ? out : null;
}

export default async function FloorPage({ params, searchParams }: PageProps<"/floor/[code]">) {
  const { code } = await params;
  const q = await searchParams;
  const c = code.toUpperCase();
  const s = await currentMember();
  if (!s || s.doc.code !== c)
    return (
      <div style={{ maxWidth: 560 }}>
        <h1>Join floor {c}</h1>
        <p className="muted">Pick a name to step onto this floor. Your avatar starts on the bench outside until you log a workout.</p>
        <JoinForms code={c} />
      </div>
    );
  // Rendered on the server so the floor never depends on a client fetch to appear.
  const initial = floorViewNow(s.doc, safeToday(null));
  return <LiveFloor code={c} initial={initial} meId={s.me.id} gain={parseGain(q.gain)} pr={q.pr === "1"} />;
}
