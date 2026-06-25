import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { weekKey, weekSequence } from "@/lib/dates";
import { loadForecastConfig } from "@/lib/forecast/config";
import { isComplianceExpired } from "@/lib/labour/allocation";

const STATUS_SEVERITY: Record<string, number> = { Valid: 0, Expiring: 1, Expired: 2 };

/** Worst (highest-severity) compliance status across a worker's records, mirroring app/api/labour/matrix/route.ts. */
function worstComplianceStatus(statuses: string[]): string {
  if (statuses.length === 0) return "Valid";
  return statuses.reduce((worst, status) => ((STATUS_SEVERITY[status] ?? 0) > (STATUS_SEVERITY[worst] ?? 0) ? status : worst));
}

/**
 * The drag-source worker pool for the Resource Planner: every worker with
 * their compliance summary (for the hover card + the lock-out guard) and a
 * map of which weeks in the forecast horizon they're already allocated
 * elsewhere, so the UI can grey out a doomed drag before it's even attempted.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("allocation.edit");
    const db = getTenantContext(session.user.organisationId);
    const now = new Date();

    const capability = req.nextUrl.searchParams.get("capability");

    const forecastConfig = await loadForecastConfig(session.user.organisationId);
    const horizonWeeks = weekSequence(now, forecastConfig.weeksOut);
    const horizonStart = horizonWeeks[0];
    const horizonEnd = horizonWeeks[horizonWeeks.length - 1];

    const workers = await db.worker.findMany({
      where: { capability: capability ?? undefined },
      include: {
        compliance: { select: { type: true, status: true, expiryDate: true } },
        skills: { select: { skill: { select: { name: true } }, level: true } },
        allocations: {
          where: { weekStart: { gte: horizonStart, lte: horizonEnd } },
          select: { weekStart: true, projectId: true, project: { select: { name: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    const thisWeek = weekKey(now);
    const rows = workers.map((worker) => {
      const busyWeeks = Object.fromEntries(
        worker.allocations.map((a) => [weekKey(a.weekStart), { projectId: a.projectId, projectName: a.project.name }])
      );
      return {
        id: worker.id,
        name: worker.name,
        photoUrl: worker.photoUrl,
        capability: worker.capability,
        status: worker.status,
        baseLocation: worker.baseLocation,
        compliance: worker.compliance,
        complianceStatus: worstComplianceStatus(worker.compliance.map((c) => c.status)),
        isComplianceExpired: isComplianceExpired(worker.compliance),
        skills: worker.skills.map((s) => ({ name: s.skill.name, level: s.level })),
        busyWeeks,
        // This week's project, if any — the hover card's "Current site" field
        // (docs/INTAKE_NOTES.md §2), so the worker pool and the allocation
        // grid's own chips agree on where a worker actually is right now.
        currentSite: busyWeeks[thisWeek]?.projectName ?? null,
      };
    });

    return NextResponse.json({ workers: rows });
  } catch (error) {
    return toErrorResponse(error);
  }
}
