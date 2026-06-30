import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { updateDependencySchema } from "@/lib/validations/dependency";
import { recomputeCriticalPath } from "@/lib/schedule/recompute";

async function loadDependencyInProject(
  db: ReturnType<typeof getTenantContext>,
  projectId: string,
  dependencyId: string
) {
  const dependency = await db.dependency.findFirst({ where: { id: dependencyId } });
  if (!dependency) return null;
  const predecessor = await db.programActivity.findFirst({
    where: { id: dependency.predecessorId, projectId },
  });
  return predecessor ? dependency : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; dependencyId: string } }) {
  try {
    const session = await requirePermission("program.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await loadDependencyInProject(db, params.id, params.dependencyId);
    if (!existing) throw new NotFoundError("Dependency not found");

    const body = updateDependencySchema.parse(await req.json());

    const dependency = await db.dependency.update({
      where: { id: params.dependencyId },
      data: { type: body.type, lagDays: body.lagDays },
    });

    await recomputeCriticalPath(db, params.id);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "dependency.update",
      entityType: "Dependency",
      entityId: dependency.id,
      before: { type: existing.type, lagDays: existing.lagDays },
      after: { type: dependency.type, lagDays: dependency.lagDays },
    });

    return NextResponse.json({ dependency });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; dependencyId: string } }) {
  try {
    const session = await requirePermission("program.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await loadDependencyInProject(db, params.id, params.dependencyId);
    if (!existing) throw new NotFoundError("Dependency not found");

    await db.dependency.delete({ where: { id: params.dependencyId } });
    await recomputeCriticalPath(db, params.id);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "dependency.delete",
      entityType: "Dependency",
      entityId: params.dependencyId,
      before: { predecessorId: existing.predecessorId, successorId: existing.successorId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
