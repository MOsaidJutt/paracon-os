import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError, BadRequestError } from "@/lib/errors";
import { upsertWorkerSkillsSchema } from "@/lib/validations/worker";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("worker.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = upsertWorkerSkillsSchema.parse(await req.json());

    const worker = await db.worker.findFirst({ where: { id: params.id } });
    if (!worker) throw new NotFoundError("Worker not found");

    const skillIds = body.skills.map((s) => s.skillId);
    const skills = await db.skill.findMany({ where: { id: { in: skillIds } } });
    if (skills.length !== new Set(skillIds).size) {
      throw new BadRequestError("One or more skills were not found");
    }

    await db.$transaction([
      db.workerSkill.deleteMany({ where: { workerId: params.id } }),
      ...body.skills.map((s) =>
        db.workerSkill.create({ data: { workerId: params.id, skillId: s.skillId, level: s.level } })
      ),
    ]);

    const updated = await db.workerSkill.findMany({ where: { workerId: params.id }, include: { skill: true } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "worker.skills_update",
      entityType: "Worker",
      entityId: params.id,
      after: { skillCount: updated.length },
    });

    return NextResponse.json({ skills: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
