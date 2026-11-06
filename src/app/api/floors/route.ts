import { NextResponse } from "next/server";
import { safeToday } from "@/lib/floor";
import { setSession } from "@/lib/server/session";
import { createFloor } from "@/lib/server/store";
import { cleanName, newCode, newMember } from "@/lib/server/util";

/** Create a floor; the creator becomes its first member. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = cleanName(body.name);
  if (!name) return NextResponse.json({ error: "Pick a name (letters and numbers)." }, { status: 400 });
  const floorName = cleanName(body.floorName, 20) ?? `${name}'S GYM`.slice(0, 20);
  const today = safeToday(body.today);
  const me = newMember(name, today);
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    if (await createFloor({ code, name: floorName, created: today, members: [me], emotes: [] })) {
      await setSession(code, me.id, me.key!);
      return NextResponse.json({ code });
    }
  }
  return NextResponse.json({ error: "Could not create floor, try again." }, { status: 500 });
}
