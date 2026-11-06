import DemoFloor from "@/components/DemoFloor";

export const metadata = { title: "Demo floor · Pixel Gym" };

export default function DemoPage() {
  return (
    <>
      <div className="floor-head">
        <div>
          <h1>Demo Gym</h1>
          <p className="muted">Eight fake lifters, each with months of history. Real clock, real body model.</p>
        </div>
      </div>
      <DemoFloor />
    </>
  );
}
