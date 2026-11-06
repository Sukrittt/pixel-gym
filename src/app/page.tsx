import Link from "next/link";
import DemoFloor from "@/components/DemoFloor";
import JoinForms from "@/components/JoinForms";
import { currentMember } from "@/lib/server/session";

export default async function Home() {
  const m = await currentMember().catch(() => null); // only link a floor that still exists
  const s = m && { code: m.doc.code };
  return (
    <>
      <section className="hero">
        <div>
          <h1>Train IRL. Your pixel self trains too.</h1>
          <p>
            Log a workout and your avatar walks to the right station on a shared gym floor, and its body changes:
            delts, arms, chest, lats, legs and bodyfat are each drawn from what you actually lift. Skip a week and it
            shows. Friends share the floor. No chat, just fist bumps.
          </p>
          <p className="row" style={{ maxWidth: 520 }}>
            {s ? (
              <Link className="btn primary" href={`/floor/${s.code}`}>GO TO MY FLOOR ({s.code})</Link>
            ) : null}
            <Link className="btn" href="/demo">OPEN DEMO FLOOR</Link>
            <Link className="btn" href="/avatar-lab">AVATAR LAB</Link>
          </p>
        </div>
        <JoinForms />
      </section>
      <DemoFloor />
    </>
  );
}
