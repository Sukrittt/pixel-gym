import { NextResponse } from "next/server";
import { applyEntry } from "@/lib/body";
import { parseWorkoutCsv } from "@/lib/csv";
import { currentMember } from "@/lib/server/session";
import { mutateFloor, SKIP } from "@/lib/server/store";
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
    const me = doc.members.find((m) => m.id === s.me.id);
    if (!me) return SKIP;
    // re-importing a newer full export must not double history: days already imported are skipped
    // ponytail: day-granular, so sets added in the app to an already-imported day aren't re-imported
    const done = new Set(me.importedDays ?? []);
    const fresh = rows.filter((x) => !done.has(x.date));
    for (const row of fresh) applyEntry(me, row.entry!, row.date, row.at);
    const days = new Set(fresh.map((x) => x.date));
    me.importedDays = [...done, ...days].sort().slice(-2000);
    return { sets: fresh.length, days: days.size, already: rows.length - fresh.length };
  });
  if (!r || r.result === SKIP) return NextResponse.json({ error: "You're no longer on this floor." }, { status: 403 });
  const out = r.result;
  return NextResponse.json({ format: parsed.format, sets: out.sets, days: out.days, alreadyImported: out.already, skipped: parsed.skipped + unknown });
}
