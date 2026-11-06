import Link from "next/link";
import MeView from "@/components/MeView";
import { readSession } from "@/lib/server/session";

export const metadata = { title: "Me · Pixel Gym" };

export default async function MePage() {
  const s = await readSession();
  if (!s)
    return (
      <p>
        Join or create a floor first: <Link href="/">home</Link>. Or scrub a demo lifter&apos;s timelapse on the <Link href="/demo">demo floor</Link>.
      </p>
    );
  return <MeView />;
}
