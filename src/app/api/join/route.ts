import { NextResponse } from "next/server";
import { safeToday } from "@/lib/floor";
import { currentMember, setSession } from "@/lib/server/session";
import { mutateFloor, resolveCode } from "@/lib/server/store";
import { cleanName, newMember } from "@/lib/server/util";

const MAX_MEMBERS = 20;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = cleanName(body.name);
  const code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!name) return NextResponse.json({ error: "Pick a name (letters and numbers)." }, { status: 400 });
  if (code.length < 4 || code.length > 8) return NextResponse.json({ error: "That invite code looks wrong." }, { status: 400 });
  const me = newMember(name, safeToday(body.today));
  // exact code first, then look-alike variants; only touch a floor that exists
  const target = await resolveCode(code);
  // already on this floor (typed your own code): keep your avatar, don't make a second one
  const cur = target ? await currentMember() : null;
  if (cur && cur.doc.code === target) return NextResponse.json({ code: target, already: true });
  const r = target
    ? await mutateFloor(target, (doc) => {
        if (doc.members.length >= MAX_MEMBERS) return "full";
        doc.members.push(me);
        return "ok";
      })
    : null;
  if (!r) return NextResponse.json({ error: "No floor with that code." }, { status: 404 });
  if (r.result === "full") return NextResponse.json({ error: `Floor is full (${MAX_MEMBERS} max).` }, { status: 409 });
  await setSession(r.doc.code, me.id, me.key!);
  return NextResponse.json({ code: r.doc.code });
}
