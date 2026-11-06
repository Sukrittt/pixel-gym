import Link from "next/link";
import LogForm from "@/components/LogForm";
import { readSession } from "@/lib/server/session";

export const metadata = { title: "Log · Pixel Gym" };

export default async function LogPage() {
  const s = await readSession();
  if (!s)
    return (
      <p>
        Join or create a floor first: <Link href="/">home</Link>.
      </p>
    );
  return (
    <>
      <h1>Quick log</h1>
      <LogForm code={s.code} />
    </>
  );
}
