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
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        active ? "bg-accent-soft font-medium" : "text-ink/80 hover:bg-accent-soft"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
