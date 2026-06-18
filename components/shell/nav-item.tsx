"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function NavItem({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex h-12 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-brass/15 text-paper"
          : "text-paper/60 hover:bg-white/5 hover:text-paper"
      )}
    >
      <Icon className="size-5 shrink-0" />
      {label}
    </Link>
  );
}
