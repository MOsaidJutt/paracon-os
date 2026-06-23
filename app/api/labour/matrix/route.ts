import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";

const STATUS_SEVERITY: Record<string, number> = { Valid: 0, Expiring: 1, Expired: 2 };

/** Worst (highest-severity) compliance status across a worker's records — drives the matrix's at-a-glance badge. */
function worstComplianceStatus(statuses: string[]): string {
  if (statuses.length === 0) return "Valid";
  return statuses.reduce((worst, status) =>
    (STATUS_SEVERITY[status] ?? 0) > (STATUS_SEVERITY[worst] ?? 0) ? status : worst
  );
}

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("labour.view");
    const db = getTenantContext(session.user.organisationId);

    const params = req.nextUrl.searchParams;
    const capability = params.getAll("capability");
    const status = params.getAll("status");
    const compliance = params.getAll("compliance");

    const [workers, skills] = await Promise.all([
      db.worker.findMany({
        where: {
          capability: capability.length > 0 ? { in: capability } : undefined,
          status: status.length > 0 ? { in: status } : undefined,
        },
        include: {
          compliance: { select: { status: true } },
          skills: { select: { skillId: true, level: true } },
        },
        orderBy: { name: "asc" },
      }),
      db.skill.findMany({ orderBy: { name: "asc" } }),
    ]);

    const rows = workers
      .map((worker) => ({
        id: worker.id,
        name: worker.name,
        photoUrl: worker.photoUrl,
        capability: worker.capability,
        status: worker.status,
        complianceStatus: worstComplianceStatus(worker.compliance.map((c) => c.status)),
        skillLevels: Object.fromEntries(worker.skills.map((s) => [s.skillId, s.level])),
      }))
      .filter((row) => compliance.length === 0 || compliance.includes(row.complianceStatus));

    return NextResponse.json({ skills, workers: rows });
  } catch (error) {
    return toErrorResponse(error);
  }
}
