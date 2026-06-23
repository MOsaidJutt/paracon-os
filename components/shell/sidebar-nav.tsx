"use client";

import { LayoutDashboard, ShieldCheck, Building2, FileSpreadsheet, HardHat, Users, Gauge } from "lucide-react";
import { NavItem } from "./nav-item";

export function SidebarNav({ permissions }: { permissions: string[] }) {
  const isAdmin = permissions.some((p) => p.startsWith("admin."));
  const isSuperAdmin = permissions.includes("platform.superadmin");
  const canViewTenders = permissions.includes("tender.view");
  const canViewProjects = permissions.includes("project.view");
  const canViewLabour = permissions.includes("labour.view");
  const canViewForecast = permissions.includes("forecast.view");

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      <NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
      {canViewTenders && <NavItem href="/tenders" label="Tenders" icon={FileSpreadsheet} />}
      {canViewProjects && <NavItem href="/projects" label="Projects" icon={HardHat} />}
      {canViewLabour && <NavItem href="/labour" label="Labour" icon={Users} />}
      {canViewForecast && <NavItem href="/forecast" label="Forecast" icon={Gauge} />}
      {isAdmin && <NavItem href="/admin/users" label="Admin" icon={ShieldCheck} />}
      {isSuperAdmin && <NavItem href="/super-admin/organisations" label="Super Admin" icon={Building2} />}
    </nav>
  );
}
