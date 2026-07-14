import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { updateSkillSchema } from "@/lib/validations/worker";

/** Renames a skill column — every worker's existing level for it carries over (WorkerSkill keys off skillId, not name). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("worker.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updateSkillSchema.parse(await req.json());

    const existing = await db.skill.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Skill not found");

    const duplicate = await db.skill.findFirst({ where: { name: body.name, id: { not: params.id } } });
    if (duplicate) throw new BadRequestError("A skill with this name already exists");

    const skill = await db.skill.update({ where: { id: params.id }, data: { name: body.name } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "skill.update",
      entityType: "Skill",
      entityId: skill.id,
      before: { name: existing.name },
      after: { name: skill.name },
    });

    return NextResponse.json({ skill });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Deletes a skill column entirely — every worker's level for it is removed too (WorkerSkill cascades). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("worker.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.skill.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Skill not found");

    await db.skill.delete({ where: { id: params.id } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "skill.delete",
      entityType: "Skill",
      entityId: params.id,
      before: { name: existing.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
