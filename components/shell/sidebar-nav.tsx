"use client";

import { LayoutDashboard, ShieldCheck, Building2, FileSpreadsheet } from "lucide-react";
import { NavItem } from "./nav-item";

export function SidebarNav({ permissions }: { permissions: string[] }) {
  const isAdmin = permissions.some((p) => p.startsWith("admin."));
  const isSuperAdmin = permissions.includes("platform.superadmin");
  const canViewTenders = permissions.includes("tender.view");

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      <NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
      {canViewTenders && <NavItem href="/tenders" label="Tenders" icon={FileSpreadsheet} />}
      {isAdmin && <NavItem href="/admin/users" label="Admin" icon={ShieldCheck} />}
      {isSuperAdmin && <NavItem href="/super-admin/organisations" label="Super Admin" icon={Building2} />}
    </nav>
  );
}
