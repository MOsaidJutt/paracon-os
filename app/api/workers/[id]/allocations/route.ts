import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { startOfIsoWeek } from "@/lib/dates";

/** Current + upcoming allocations for one worker — powers the worker profile's Allocation tab. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("allocation.edit");
    const db = getTenantContext(session.user.organisationId);

    const worker = await db.worker.findFirst({ where: { id: params.id } });
    if (!worker) throw new NotFoundError("Worker not found");

    const allocations = await db.allocation.findMany({
      where: { workerId: params.id, weekStart: { gte: startOfIsoWeek(new Date()) } },
      include: { project: { select: { id: true, name: true, code: true } } },
      orderBy: { weekStart: "asc" },
    });

    return NextResponse.json({ allocations });
  } catch (error) {
    return toErrorResponse(error);
  }
}
