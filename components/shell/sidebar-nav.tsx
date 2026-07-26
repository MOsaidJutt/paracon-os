"use client";

import { LayoutDashboard, ShieldCheck, Building2, Target, FileSpreadsheet, HardHat, BookUser, Users, UploadCloud, Wallet, CalendarRange, ClipboardList } from "lucide-react";
import { NavItem } from "./nav-item";
import type { ViewMode } from "@/lib/view-mode";

export function SidebarNav({
  permissions,
  superAdminEnabled,
  viewMode,
}: {
  permissions: string[];
  superAdminEnabled: boolean;
  viewMode: ViewMode;
}) {
  const isAdmin = permissions.some((p) => p.startsWith("admin."));
  const isSuperAdmin = permissions.includes("platform.superadmin");
  const canViewProspects = permissions.includes("prospect.view");
  const canViewTenders = permissions.includes("tender.view");
  const canViewProjects = permissions.includes("project.view");
  const canViewContacts = permissions.includes("tender.view") || permissions.includes("labour.view");
  const canViewLabour = permissions.includes("labour.view");
  const canEditAllocation = permissions.includes("allocation.edit");
  const canRunImports = permissions.includes("import.run");
  const canViewFinance = permissions.includes("finance.view");
  const canUpdateSite = permissions.includes("site.update");

  // SIMPLIFIED — the five agreed modules, in business-flow order. Labour,
  // Resource Planner, Forecast, Scorecard and Import Centre aren't gone: they
  // are reached from inside Projects and Directory, and every one of them is
  // one toggle away in the Full view. Finance is hidden here by design and
  // keeps its code, its routes and its Full-view entry. Admin stays visible so
  // a director is never stranded without settings in the default view.
  if (viewMode === "SIMPLE") {
    return (
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        <NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
        {canUpdateSite && <NavItem href="/site" label="Daily Update" icon={ClipboardList} />}
        {canViewProspects && <NavItem href="/prospects" label="Prospects" icon={Target} />}
        {canViewTenders && <NavItem href="/tenders" label="Pre-Construction" icon={FileSpreadsheet} />}
        {canViewProjects && <NavItem href="/projects" label="Projects" icon={HardHat} />}
        {canViewContacts && <NavItem href="/contacts/clients" label="Directory" icon={BookUser} />}
        {isAdmin && <NavItem href="/admin/users" label="Admin" icon={ShieldCheck} />}
        {isSuperAdmin && superAdminEnabled && (
          <NavItem href="/super-admin/organisations" label="Super Admin" icon={Building2} />
        )}
      </nav>
    );
  }

  // FULL — every screen built through phases 0-18, unchanged.
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      <NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
      {canUpdateSite && <NavItem href="/site" label="Daily Update" icon={ClipboardList} />}
      {canViewProspects && <NavItem href="/prospects" label="Prospects" icon={Target} />}
      {canViewTenders && <NavItem href="/tenders" label="Tenders" icon={FileSpreadsheet} />}
      {canViewProjects && <NavItem href="/projects" label="Projects" icon={HardHat} />}
      {canViewContacts && <NavItem href="/contacts/clients" label="Contacts" icon={BookUser} />}
      {canViewLabour && <NavItem href="/labour" label="Labour" icon={Users} />}
      {canEditAllocation && <NavItem href="/allocation" label="Resource Planner" icon={CalendarRange} />}
      {canViewFinance && <NavItem href="/finance" label="Finance" icon={Wallet} />}
      {canRunImports && <NavItem href="/import" label="Import Centre" icon={UploadCloud} />}
      {isAdmin && <NavItem href="/admin/users" label="Admin" icon={ShieldCheck} />}
      {isSuperAdmin && superAdminEnabled && (
        <NavItem href="/super-admin/organisations" label="Super Admin" icon={Building2} />
      )}
    </nav>
  );
}
