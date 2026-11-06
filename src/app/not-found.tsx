import Link from "next/link";
import { currentMember } from "@/lib/server/session";

export const metadata = { title: "Not found · Pixel Gym" };

export default async function NotFound() {
  // only offer "back to my floor" if that floor still exists and you're on it
  const s = await currentMember().catch(() => null);
  return (
    <div className="panel" style={{ maxWidth: 560 }}>
      <h1 style={{ color: "var(--ink)", textShadow: "none", fontSize: 28 }}>Nothing here</h1>
      <p>That floor or page doesn&apos;t exist. Check the invite link with whoever sent it{s ? "" : ", or start your own floor"}.</p>
      <div className="actions">
        {s && (
          <Link className="btn primary" href={`/floor/${s.doc.code}`}>BACK TO MY FLOOR</Link>
        )}
        <Link className={s ? "btn" : "btn primary"} href="/">CREATE A FLOOR</Link>
        <Link className="btn" href="/demo">SEE THE DEMO</Link>
      </div>
    </div>
  );
}
