import type { Metadata } from "next";
import Link from "next/link";
import { Silkscreen } from "next/font/google";
import NavLinks from "@/components/NavLinks";
import TzCookie from "@/components/TzCookie";
import { readSession } from "@/lib/server/session";
import "./globals.css";

const pixel = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-pixel" });

export const metadata: Metadata = {
  title: "Pixel Gym",
  description: "Train in real life. Your pixel avatar trains too, and its body visibly transforms. Friends share the floor.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const s = await readSession();
  return (
    <html lang="en" className={pixel.variable}>
      <body>
        <TzCookie />
        <nav className="nav">
          <Link href="/" className="brand">PIXEL GYM</Link>
          <NavLinks floor={s?.code ?? null} />
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
