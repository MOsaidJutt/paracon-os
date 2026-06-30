import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";

export async function GET(_req: NextRequest, { params }: { params: { id: string; baselineId: string } }) {
  try {
    const session = await requirePermission("project.view");
    const db = getTenantContext(session.user.organisationId);

    const baseline = await db.baseline.findFirst({
      where: { id: params.baselineId, projectId: params.id },
      include: { tasks: true, savedBy: { select: { id: true, name: true } } },
    });
    if (!baseline) throw new NotFoundError("Baseline not found");

    return NextResponse.json({ baseline });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; baselineId: string } }) {
  try {
    const session = await requirePermission("program.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.baseline.findFirst({ where: { id: params.baselineId, projectId: params.id } });
    if (!existing) throw new NotFoundError("Baseline not found");

    await db.baseline.delete({ where: { id: params.baselineId } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "baseline.delete",
      entityType: "Baseline",
      entityId: params.baselineId,
      before: { name: existing.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
