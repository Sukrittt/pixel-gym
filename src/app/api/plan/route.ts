import { NextResponse } from "next/server";
import { currentMember } from "@/lib/server/session";
import { mutateFloor, SKIP } from "@/lib/server/store";
import { PLAN_SLOTS } from "@/lib/templates";

/** Save your weekly plan: 7 slots, index = weekday (0 = Sunday). */
export async function POST(req: Request) {
  const s = await currentMember();
  if (!s) return NextResponse.json({ error: "Join a floor first." }, { status: 401 });
  const plan = (await req.json().catch(() => null))?.plan;
  if (!Array.isArray(plan) || plan.length !== 7 || !plan.every((p) => typeof p === "string" && PLAN_SLOTS.includes(p)))
    return NextResponse.json({ error: "Bad plan." }, { status: 400 });
  const r = await mutateFloor(s.doc.code, (doc) => {
    const me = doc.members.find((m) => m.id === s.me.id);
    if (!me) return SKIP;
    if (plan.some(Boolean)) me.plan = plan;
    else delete me.plan; // all rest = no plan
    return true;
  });
  if (!r || r.result === SKIP) return NextResponse.json({ error: "Could not save your plan." }, { status: 404 });
  return NextResponse.json({ plan });
}
