import { NextResponse } from "next/server";
import { applyEntry } from "@/lib/body";
import { parseWorkoutCsv } from "@/lib/csv";
import { currentMember } from "@/lib/server/session";
import { mutateFloor } from "@/lib/server/store";
import { cleanEntry } from "@/lib/server/util";

const MAX_BYTES = 3_000_000;

/** Hevy / Strong CSV import. Body: raw CSV text. */
export async function POST(req: Request) {
  const s = await currentMember(true);
  if (!s) return NextResponse.json({ error: "Join a floor first." }, { status: 401 });
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "File too big (3 MB max)." }, { status: 413 });
  const parsed = parseWorkoutCsv(text);
  const rows = parsed.rows.map((r) => ({ ...r, entry: cleanEntry(r.entry) })).filter((r) => r.entry);
  const unknown = parsed.rows.length - rows.length;
  if (!rows.length) return NextResponse.json({ error: `No usable sets found (format: ${parsed.format}).` }, { status: 400 });
  const r = await mutateFloor(s.doc.code, (doc) => {
    const me = doc.members.find((m) => m.id === s.me.id)!;
    for (const row of rows) applyEntry(me, row.entry!, row.date, row.at);
    return new Set(rows.map((x) => x.date)).size;
  });
  return NextResponse.json({ format: parsed.format, sets: rows.length, days: r?.result ?? 0, skipped: parsed.skipped + unknown });
}
