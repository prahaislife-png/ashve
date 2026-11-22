"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({
  href,
  icon,
  label,
  exact = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}) {
  const path = usePathname();
  const active = exact ? path === href : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
        active ? "bg-card font-medium text-ink shadow-elev-sm" : "text-ink-2 hover:bg-card hover:text-ink"
      }`}
    >
      <span className={active ? "text-accent" : "text-muted"}>{icon}</span>
      {label}
    </Link>
  );
}
