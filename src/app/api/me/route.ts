import { NextResponse } from "next/server";
import { meData, safeToday } from "@/lib/floor";
import { currentMember } from "@/lib/server/session";

export async function GET(req: Request) {
  const s = await currentMember();
  if (!s) return NextResponse.json({ error: "Join a floor first." }, { status: 401 });
  return NextResponse.json(meData(s.doc, s.me, safeToday(new URL(req.url).searchParams.get("today"))));
}
