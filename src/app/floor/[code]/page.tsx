import JoinForms from "@/components/JoinForms";
import LiveFloor from "@/components/LiveFloor";
import { readSession } from "@/lib/server/session";

export default async function FloorPage({ params }: PageProps<"/floor/[code]">) {
  const { code } = await params;
  const c = code.toUpperCase();
  const s = await readSession();
  if (!s || s.code !== c)
    return (
      <div style={{ maxWidth: 560 }}>
        <h1>Join floor {c}</h1>
        <p className="muted">Pick a name to step onto this floor.</p>
        <JoinForms code={c} />
      </div>
    );
  return <LiveFloor code={c} />;
}
