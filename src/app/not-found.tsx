import Link from "next/link";
import { readSession } from "@/lib/server/session";

export const metadata = { title: "Not found · Pixel Gym" };

export default async function NotFound() {
  const s = await readSession();
  return (
    <div className="panel" style={{ maxWidth: 560 }}>
      <h1 style={{ color: "var(--ink)", textShadow: "none", fontSize: 28 }}>Nothing here</h1>
      <p>That floor or page doesn&apos;t exist. Check the invite link with whoever sent it{s ? "" : ", or start your own floor"}.</p>
      <div className="actions">
        {s ? (
          <Link className="btn primary" href={`/floor/${s.code}`}>BACK TO MY FLOOR</Link>
        ) : (
          <Link className="btn primary" href="/">CREATE A FLOOR</Link>
        )}
        <Link className="btn" href="/demo">SEE THE DEMO</Link>
      </div>
    </div>
  );
}
