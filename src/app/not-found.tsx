import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel" style={{ maxWidth: 560 }}>
      <title>Not found · Pixel Gym</title>
      <h2>Nothing here</h2>
      <p>That floor or page doesn&apos;t exist. Check the invite link with whoever sent it, or start your own floor.</p>
      <div className="actions">
        <Link className="btn primary" href="/">CREATE A FLOOR</Link>
        <Link className="btn" href="/demo">SEE THE DEMO</Link>
      </div>
    </div>
  );
}
