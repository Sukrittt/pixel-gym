import { NextResponse } from "next/server";
import { memberView, safeToday, seriesFor } from "@/lib/floor";
import { currentMember } from "@/lib/server/session";

export async function GET(req: Request) {
  const s = await currentMember();
  if (!s) return NextResponse.json({ error: "Join a floor first." }, { status: 401 });
  const today = safeToday(new URL(req.url).searchParams.get("today"));
  const days = Object.entries(s.me.days)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, d]) => ({ date, focus: d.focus, total: Math.round(d.total), sets: d.sets, cardioMin: d.cardioMin, km: d.km, bw: d.bw, pr: !!d.pr }));
  return NextResponse.json({ code: s.doc.code, floorName: s.doc.name, me: memberView(s.me, today, Date.now()), series: seriesFor(s.me, today), days });
}
