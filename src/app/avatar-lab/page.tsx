import AvatarLab from "@/components/AvatarLab";

export const metadata = { title: "Avatar lab · Pixel Gym" };

export default function LabPage() {
  return (
    <>
      <h1>Avatar lab</h1>
      <p className="muted">Six body params (0–10) plus skin saturation. Every body part is drawn procedurally from its own param: drag a slider and watch that part change.</p>
      <AvatarLab />
    </>
  );
}
