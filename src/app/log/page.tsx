import Link from "next/link";
import LogForm from "@/components/LogForm";
import { formatKg } from "@/lib/floor";
import { currentMember, requestToday } from "@/lib/server/session";

export const metadata = { title: "Log · Pixel Gym" };

export default async function LogPage() {
  const s = await currentMember(true);
  if (!s)
    return (
      <p>
        Join or create a floor first: <Link href="/">home</Link>.
      </p>
    );
  const d = s.me.days[await requestToday()];
  const summary = d ? [d.focus, d.total ? formatKg(d.total) : "", d.cardioMin ? `${d.cardioMin} min cardio` : ""].filter(Boolean).join(" · ") : null;
  return (
    <>
      <h1>Quick log</h1>
      <LogForm code={s.doc.code} loggedToday={summary} />
    </>
  );
}
