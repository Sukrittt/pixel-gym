"use client";
import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel" style={{ maxWidth: 560 }}>
      <h2>Something dropped the bar.</h2>
      <p>We couldn&apos;t load this page. Your logs are safe. It&apos;s usually a blip with storage.</p>
      <div className="actions">
        <button className="primary" onClick={reset}>TRY AGAIN</button>
        <Link className="btn" href="/">HOME</Link>
      </div>
    </div>
  );
}
