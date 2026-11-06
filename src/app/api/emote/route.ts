import { NextResponse } from "next/server";
import { currentMember } from "@/lib/server/session";
import { mutateFloor, SKIP } from "@/lib/server/store";
import { newId } from "@/lib/server/util";

const KINDS = ["bump", "flex", "clap"] as const;

export async function POST(req: Request) {
  const s = await currentMember();
  if (!s) return NextResponse.json({ error: "Join a floor first." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const kind = KINDS.find((k) => k === body.kind);
  if (!kind || !s.doc.members.some((m) => m.id === body.to) || body.to === s.me.id) return NextResponse.json({ error: "Bad emote." }, { status: 400 });
  const r = await mutateFloor(s.doc.code, (doc) => {
    const now = Date.now();
    // one emote per sender every 3s keeps spam (and blob writes) down
    if (doc.emotes.some((e) => e.from === s.me.id && now - Date.parse(e.at) < 3000)) return SKIP;
    const cutoff = new Date(now - 5 * 60000).toISOString();
    doc.emotes = [...doc.emotes.filter((e) => e.at > cutoff), { id: newId(4), from: s.me.id, to: body.to, kind, at: new Date(now).toISOString() }].slice(-100);
    return true;
  });
  if (!r || r.result === SKIP) return NextResponse.json({ error: "Easy, one emote every few seconds." }, { status: 429 });
  return NextResponse.json({ ok: true });
}
