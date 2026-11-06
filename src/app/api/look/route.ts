import { NextResponse } from "next/server";
import { currentMember } from "@/lib/server/session";
import { mutateFloor } from "@/lib/server/store";
import { cleanLook, randomLook } from "@/lib/server/util";

/** Reroll your avatar's skin / hair / clothes. */
export async function POST(req: Request) {
  const s = await currentMember();
  if (!s) return NextResponse.json({ error: "Join a floor first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const look = body?.look === undefined ? randomLook() : cleanLook(body.look);
  if (!look) return NextResponse.json({ error: "Bad look." }, { status: 400 });
  const r = await mutateFloor(s.doc.code, (doc) => {
    const me = doc.members.find((m) => m.id === s.me.id);
    if (me) me.look = look;
    return !!me;
  });
  if (!r?.result) return NextResponse.json({ error: "Could not save your look." }, { status: 404 });
  return NextResponse.json({ look });
}
