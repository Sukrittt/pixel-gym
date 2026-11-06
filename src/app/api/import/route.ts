import { NextResponse } from "next/server";
import { applyEntry } from "@/lib/body";
import { parseWorkoutCsv } from "@/lib/csv";
import { currentMember } from "@/lib/server/session";
import { mutateFloor, SKIP } from "@/lib/server/store";
import { cleanEntry } from "@/lib/server/util";

const MAX_BYTES = 3_000_000;

/** Short stable key for one imported set (FNV-1a, base36). */
function setKey(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

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
    // re-importing a newer full export must not double history: each set gets a key
    // (date, time, exercise, numbers, nth identical set) and known keys are skipped
    const done = new Set(me.importedSets ?? []);
    const seenNow = new Map<string, number>();
    const fresh = rows.filter((x) => {
      const base = JSON.stringify([x.date, x.at, x.entry]);
      const n = (seenNow.get(base) ?? 0) + 1;
      seenNow.set(base, n);
      const k = setKey(base + "#" + n);
      if (done.has(k)) return false;
      done.add(k);
      return true;
    });
    if (!fresh.length) return SKIP; // nothing new: no write
    for (const row of fresh) applyEntry(me, row.entry!, row.date, row.at);
    // ponytail: capped key list (~8 bytes/set); a 20k+ set history re-imports its oldest sets
    me.importedSets = [...done].slice(-20000);
    return { sets: fresh.length, days: new Set(fresh.map((x) => x.date)).size };
  });
  if (!r) return NextResponse.json({ error: "Floor not found." }, { status: 404 });
  const stillMember = r.doc.members.some((m) => m.id === s.me.id);
  if (!stillMember) return NextResponse.json({ error: "You're no longer on this floor." }, { status: 403 });
  const out = r.result === SKIP ? { sets: 0, days: 0 } : r.result;
  return NextResponse.json({ format: parsed.format, sets: out.sets, days: out.days, alreadyImported: rows.length - out.sets, skipped: parsed.skipped + unknown });
}
