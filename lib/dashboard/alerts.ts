import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/tenders/format";
import { startOfIsoWeek } from "@/lib/dates";

export type AlertSeverity = "amber" | "red";
export type Alert = {
  id: string;
  type: "shortage" | "compliance";
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string;
};

export type ShortageGapInput = {
  projectId?: string;
  projectName?: string;
  role: string;
  // 0 = current week (or current forecast block, for the org-wide reading).
  weekIndex: number;
  // demand - supply/allocated. Only positive values become an alert.
  gap: number;
};

/** A shortage right now (index 0) is red; a shortage later in the watch window is amber. */
export function deriveShortageAlerts(entries: ShortageGapInput[]): Alert[] {
  return entries
    .filter((e) => e.gap > 0)
    .map((e) => {
      const when = e.weekIndex === 0 ? "this week" : `in ${e.weekIndex} week${e.weekIndex > 1 ? "s" : ""}`;
      const where = e.projectName ?? "Org-wide";
      return {
        id: `shortage:${e.projectId ?? "org"}:${e.role}:${e.weekIndex}`,
        type: "shortage" as const,
        severity: e.weekIndex === 0 ? ("red" as const) : ("amber" as const),
        title: `${e.role} shortage`,
        detail: `${where} — short ${e.gap} ${e.role}${e.gap > 1 ? "s" : ""} ${when}`,
        href: e.projectId ? `/projects/${e.projectId}` : "/forecast",
      };
    });
}

export type ComplianceAlertInput = {
  id: string;
  workerId: string;
  workerName: string;
  type: string;
  status: "Expiring" | "Expired";
  expiryDate: Date | null;
};

export function deriveComplianceAlerts(rows: ComplianceAlertInput[]): Alert[] {
  return rows.map((r) => ({
    id: `compliance:${r.id}`,
    type: "compliance" as const,
    severity: r.status === "Expired" ? ("red" as const) : ("amber" as const),
    title: `${r.type} ${r.status.toLowerCase()}`,
    detail: `${r.workerName} — ${r.type}${r.expiryDate ? ` (${formatDate(r.expiryDate)})` : ""}`,
    href: `/labour/${r.workerId}`,
  }));
}

/** Red before amber, otherwise stable — the shared ordering for every alert list across the dashboards. */
export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "red" ? -1 : 1));
}

/**
 * Compliance alerts (Expiring/Expired) for this org, optionally narrowed to
 * workers currently or imminently allocated to one of `projectIds` (the PM
 * dashboard's scope) — the Director reading is left unscoped, org-wide.
 */
export async function getComplianceAlerts(organisationId: string, projectIds?: string[]): Promise<Alert[]> {
  const rows = await prisma.compliance.findMany({
    where: {
      organisationId,
      status: { in: ["Expiring", "Expired"] },
      ...(projectIds
        ? {
            worker: {
              allocations: { some: { projectId: { in: projectIds }, weekStart: { gte: startOfIsoWeek(new Date()) } } },
            },
          }
        : {}),
    },
    include: { worker: { select: { id: true, name: true } } },
    orderBy: { expiryDate: "asc" },
  });

  return deriveComplianceAlerts(
    rows.map((r) => ({
      id: r.id,
      workerId: r.worker.id,
      workerName: r.worker.name,
      type: r.type,
      status: r.status as "Expiring" | "Expired",
      expiryDate: r.expiryDate,
    }))
  );
}
