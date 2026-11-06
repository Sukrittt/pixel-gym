"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Top nav with the current page marked (aria-current). */
export default function NavLinks({ floor }: { floor: string | null }) {
  const path = usePathname();
  const links: [string, string][] = [...(floor ? ([[`/floor/${floor}`, "My floor"]] as [string, string][]) : []), ["/demo", "Demo"], ["/log", "Log"], ["/me", "Me"], ["/avatar-lab", "Avatar lab"]];
  return (
    <>
      {links.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined} aria-label={label}>
          {label === "Avatar lab" ? (
            <>
              <span className="hide-sm">Avatar </span>lab
            </>
          ) : (
            label
          )}
        </Link>
      ))}
    </>
  );
}
