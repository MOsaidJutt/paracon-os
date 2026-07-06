import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { createAllocationSchema } from "@/lib/validations/allocation";
import { assertAllocatable } from "@/lib/labour/allocation";
import { startOfIsoWeek } from "@/lib/dates";
import { sendEvent } from "@/lib/inngest/send-safe";

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("allocation.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createAllocationSchema.parse(await req.json());
    const weekStart = startOfIsoWeek(body.weekStart);

    const [worker, project] = await Promise.all([
      db.worker.findFirst({
        where: { id: body.workerId },
        select: {
          capability: true,
          compliance: { select: { type: true, status: true, expiryDate: true } },
        },
      }),
      db.project.findFirst({ where: { id: body.projectId } }),
    ]);
    if (!worker) throw new NotFoundError("Worker not found");
    if (!project) throw new NotFoundError("Project not found");

    const existingAtWeek = await db.allocation.findFirst({
      where: { workerId: body.workerId, weekStart },
      select: { id: true, projectId: true, weekStart: true },
    });

    assertAllocatable({
      compliance: worker.compliance,
      existing: existingAtWeek ? [existingAtWeek] : [],
      weekStart,
      projectId: body.projectId,
      workerCapability: worker.capability,
      role: body.role,
    });

    let allocation;
    try {
      allocation = await db.allocation.create({
        data: {
          organisationId: session.user.organisationId,
          workerId: body.workerId,
          projectId: body.projectId,
          weekStart,
          createdByUserId: session.user.id,
        },
      });
    } catch (error) {
      // Race-condition safety net behind the pre-check above — the @@unique
      // constraint is the real guarantee; a concurrent request that slips past
      // the pre-check still surfaces as a clean 409, never a raw DB error.
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw new ConflictError("Worker is already allocated for that week.");
      }
      throw error;
    }

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "allocation.create",
      entityType: "Allocation",
      entityId: allocation.id,
      after: { workerId: body.workerId, projectId: body.projectId, weekStart },
    });
    await sendEvent("forecast/recompute.requested");

    return NextResponse.json({ allocation }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
