"use client";

import { LayoutDashboard, ShieldCheck, Building2, FileSpreadsheet, HardHat, Users, Gauge, UploadCloud, Wallet, CalendarRange, ClipboardList, Star } from "lucide-react";
import { NavItem } from "./nav-item";

export function SidebarNav({ permissions }: { permissions: string[] }) {
  const isAdmin = permissions.some((p) => p.startsWith("admin."));
  const isSuperAdmin = permissions.includes("platform.superadmin");
  const canViewTenders = permissions.includes("tender.view");
  const canViewProjects = permissions.includes("project.view");
  const canViewLabour = permissions.includes("labour.view");
  const canViewForecast = permissions.includes("forecast.view");
  const canEditAllocation = permissions.includes("allocation.edit");
  const canRunImports = permissions.includes("import.run");
  const canViewFinance = permissions.includes("finance.view");
  const canUpdateSite = permissions.includes("site.update");
  const canViewScorecard = permissions.includes("scorecard.view");

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      <NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
      {canUpdateSite && <NavItem href="/site" label="Daily Update" icon={ClipboardList} />}
      {canViewTenders && <NavItem href="/tenders" label="Tenders" icon={FileSpreadsheet} />}
      {canViewProjects && <NavItem href="/projects" label="Projects" icon={HardHat} />}
      {canViewLabour && <NavItem href="/labour" label="Labour" icon={Users} />}
      {canViewScorecard && <NavItem href="/scorecard" label="Scorecard" icon={Star} />}
      {canViewForecast && <NavItem href="/forecast" label="Forecast" icon={Gauge} />}
      {canEditAllocation && <NavItem href="/allocation" label="Resource Planner" icon={CalendarRange} />}
      {canViewFinance && <NavItem href="/finance" label="Finance" icon={Wallet} />}
      {canRunImports && <NavItem href="/import" label="Import Centre" icon={UploadCloud} />}
      {isAdmin && <NavItem href="/admin/users" label="Admin" icon={ShieldCheck} />}
      {isSuperAdmin && <NavItem href="/super-admin/organisations" label="Super Admin" icon={Building2} />}
    </nav>
  );
}
