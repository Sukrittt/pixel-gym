import { NextResponse } from "next/server";
import { applyEntry } from "@/lib/body";
import { buildFloorView, safeToday } from "@/lib/floor";
import { currentMember } from "@/lib/server/session";
import { mutateFloor } from "@/lib/server/store";
import { cleanEntry } from "@/lib/server/util";

export async function POST(req: Request) {
  const s = await currentMember(true);
  if (!s) return NextResponse.json({ error: "Join a floor first." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const entries = (Array.isArray(body.entries) ? body.entries : []).slice(0, 60).map(cleanEntry);
  if (!entries.length || entries.some((e: unknown) => !e)) return NextResponse.json({ error: "Some entries were invalid." }, { status: 400 });
  const today = safeToday(body.today);
  const at = new Date().toISOString();
  const r = await mutateFloor(s.doc.code, (doc) => {
    const me = doc.members.find((m) => m.id === s.me.id)!;
    return entries.some((e: NonNullable<ReturnType<typeof cleanEntry>>) => applyEntry(me, e, today, at).pr);
  });
  if (!r) return NextResponse.json({ error: "Floor not found." }, { status: 404 });
  return NextResponse.json({ pr: r.result, code: r.doc.code, view: buildFloorView(r.doc, today, Date.now()) });
}
