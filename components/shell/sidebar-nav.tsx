"use client";

import { LayoutDashboard, ShieldCheck } from "lucide-react";
import { NavItem } from "./nav-item";

export function SidebarNav({ permissions }: { permissions: string[] }) {
  const isAdmin = permissions.some((p) => p.startsWith("admin."));

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      <NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
      {isAdmin && <NavItem href="/admin/users" label="Admin" icon={ShieldCheck} />}
    </nav>
  );
}
