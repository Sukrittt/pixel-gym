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
    // re-importing a newer full export must not double history: each set's source key
    // (see parseWorkoutCsv) is remembered and known keys are skipped
    const done = new Set(me.importedSets ?? []);
    const fresh = rows.filter((x) => !done.has(x.key) && (done.add(x.key), true));
    if (!fresh.length) return SKIP; // nothing new: no write
    for (const row of fresh) applyEntry(me, row.entry!, row.date, row.at);
    // ponytail: keys kept in insertion order, capped (14 chars ≈ 17 bytes/set in JSON, ~340KB at the cap); past 20k sets the
    // earliest-imported keys fall off and those sets could re-import. Fine for v1 histories.
    me.importedSets = [...done].slice(-20000);
    return { sets: fresh.length, days: new Set(fresh.map((x) => x.date)).size };
  });
  if (!r) return NextResponse.json({ error: "Floor not found." }, { status: 404 });
  const stillMember = r.doc.members.some((m) => m.id === s.me.id);
  if (!stillMember) return NextResponse.json({ error: "You're no longer on this floor." }, { status: 403 });
  const out = r.result === SKIP ? { sets: 0, days: 0 } : r.result;
  return NextResponse.json({ format: parsed.format, sets: out.sets, days: out.days, alreadyImported: rows.length - out.sets, skipped: parsed.skipped + unknown });
}
