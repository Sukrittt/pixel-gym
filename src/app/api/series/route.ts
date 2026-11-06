import { NextResponse } from "next/server";
import { safeToday, seriesFor } from "@/lib/floor";
import { currentMember } from "@/lib/server/session";

/** Day-by-day body snapshots of a floor-mate, for the timelapse. */
export async function GET(req: Request) {
  const s = await currentMember();
  if (!s) return NextResponse.json({ error: "Join a floor first." }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const m = s.doc.members.find((x) => x.id === q.get("id"));
  if (!m) return NextResponse.json({ error: "Not on your floor." }, { status: 404 });
  return NextResponse.json({ series: seriesFor(m, safeToday(q.get("today"))) });
}
