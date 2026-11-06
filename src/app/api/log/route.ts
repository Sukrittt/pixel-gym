import { NextResponse } from "next/server";
import { applyEntry, PARAMS, type Params } from "@/lib/body";
import { buildFloorView, memberView, safeToday } from "@/lib/floor";
import { currentMember } from "@/lib/server/session";
import { mutateFloor, SKIP } from "@/lib/server/store";
import { cleanEntry } from "@/lib/server/util";

export async function POST(req: Request) {
  const s = await currentMember();
  if (!s) return NextResponse.json({ error: "Join a floor first." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const entries = (Array.isArray(body.entries) ? body.entries : []).slice(0, 60).map(cleanEntry);
  if (!entries.length || entries.some((e: unknown) => !e)) return NextResponse.json({ error: "Some entries were invalid." }, { status: 400 });
  // client-generated id makes a retried save (lost response, double tap) a no-op
  const logId = typeof body.logId === "string" ? body.logId.slice(0, 40) : null;
  const today = safeToday(body.today);
  const at = new Date().toISOString();
  let before: Params | null = null;
  const r = await mutateFloor(s.doc.code, (doc) => {
    const me = doc.members.find((m) => m.id === s.me.id);
    if (!me) return SKIP;
    if (logId && me.recentLogs?.includes(logId)) return SKIP;
    before = memberView(me, today, Date.now()).params; // same doc the gains are computed against
    if (logId) me.recentLogs = [...(me.recentLogs ?? []), logId].slice(-20);
    return entries.some((e: NonNullable<ReturnType<typeof cleanEntry>>) => applyEntry(me, e, today, at).pr);
  });
  if (!r) return NextResponse.json({ error: "Floor not found." }, { status: 404 });
  const view = buildFloorView(r.doc, today, Date.now());
  const after = view.members.find((m) => m.id === s.me.id)?.params;
  if (!after) return NextResponse.json({ error: "You're no longer on this floor." }, { status: 403 });
  const b = before as Params | null;
  const gains = b ? Object.fromEntries(PARAMS.map((k) => [k, Math.round((after[k] - b[k]) * 100) / 100])) : {};
  return NextResponse.json({ pr: r.result === true, duplicate: r.result === SKIP, code: r.doc.code, gains, view });
}
