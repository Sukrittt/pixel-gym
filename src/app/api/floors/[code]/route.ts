import { NextResponse } from "next/server";
import { buildFloorView, safeToday } from "@/lib/floor";
import { currentMember } from "@/lib/server/session";

/** Floor state for polling. Private: only members of this floor. */
export async function GET(req: Request, ctx: RouteContext<"/api/floors/[code]">) {
  const { code } = await ctx.params;
  const s = await currentMember();
  if (!s || s.doc.code !== code.toUpperCase()) return NextResponse.json({ error: "Not a member of this floor." }, { status: 403 });
  const today = safeToday(new URL(req.url).searchParams.get("today"));
  return NextResponse.json({ view: buildFloorView(s.doc, today, Date.now()), meId: s.me.id });
}
