import AvatarLab from "@/components/AvatarLab";

export const metadata = { title: "Avatar lab · Pixel Gym" };

export default function LabPage() {
  return (
    <>
      <h1>Avatar lab</h1>
      <p className="muted">Six params, each 0–10. Every body part is drawn procedurally from its param, so you can judge whether the detail reads.</p>
      <AvatarLab />
    </>
  );
}
