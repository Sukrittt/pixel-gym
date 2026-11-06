import { NextResponse } from "next/server";
import { currentMember } from "@/lib/server/session";
import { mutateFloor } from "@/lib/server/store";
import { randomLook } from "@/lib/server/util";

/** Reroll your avatar's skin / hair / clothes. */
export async function POST() {
  const s = await currentMember();
  if (!s) return NextResponse.json({ error: "Join a floor first." }, { status: 401 });
  const look = randomLook();
  await mutateFloor(s.doc.code, (doc) => {
    const me = doc.members.find((m) => m.id === s.me.id);
    if (me) me.look = look;
  });
  return NextResponse.json({ look });
}
