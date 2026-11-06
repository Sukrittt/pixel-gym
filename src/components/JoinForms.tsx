"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { localDate } from "@/lib/floor";

async function post(url: string, body: object) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, today: localDate() }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
  return j as { code: string };
}

export default function JoinForms({ code: preset }: { code?: string }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = (url: string) => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { code } = await post(url, Object.fromEntries(new FormData(e.currentTarget)));
      router.push(`/floor/${code}`);
      router.refresh();
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="forms">
      <form className="panel" onSubmit={submit("/api/join")}>
        <h3>JOIN A FLOOR</h3>
        <div className="row">
          <label>
            YOUR NAME
            <input name="name" maxLength={12} required placeholder="Sukrit" />
          </label>
          <label>
            INVITE CODE
            <input name="code" defaultValue={preset} required placeholder="K7Q2XM" style={{ textTransform: "uppercase" }} />
          </label>
        </div>
        <button className="primary" disabled={busy}>JOIN FLOOR</button>
      </form>
      {!preset && (
        <form className="panel" onSubmit={submit("/api/floors")}>
          <h3>CREATE A FLOOR</h3>
          <div className="row">
            <label>
              YOUR NAME
              <input name="name" maxLength={12} required placeholder="Sukrit" />
            </label>
            <label>
              FLOOR NAME
              <input name="floorName" maxLength={20} placeholder="Iron Paradise" />
            </label>
          </div>
          <button disabled={busy}>CREATE · GET INVITE CODE</button>
        </form>
      )}
      {err && <p className="err">{err}</p>}
    </div>
  );
}
