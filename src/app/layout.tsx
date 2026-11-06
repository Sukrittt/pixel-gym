import type { Metadata } from "next";
import Link from "next/link";
import { Silkscreen } from "next/font/google";
import "./globals.css";

const pixel = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-pixel" });

export const metadata: Metadata = {
  title: "Pixel Gym",
  description: "Train in real life. Your pixel avatar trains too, and its body visibly transforms. Friends share the floor.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={pixel.variable}>
      <body>
        <nav className="nav">
          <Link href="/" className="brand">PIXEL GYM</Link>
          <Link href="/demo">Demo</Link>
          <Link href="/log">Log</Link>
          <Link href="/me">Me</Link>
          <Link href="/avatar-lab">Avatar lab</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
