import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError } from "@/lib/errors";
import { createSkillSchema } from "@/lib/validations/worker";

export async function GET() {
  try {
    const session = await requirePermission("labour.view");
    const db = getTenantContext(session.user.organisationId);

    const skills = await db.skill.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ skills });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("worker.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createSkillSchema.parse(await req.json());

    const existing = await db.skill.findFirst({ where: { name: body.name } });
    if (existing) throw new BadRequestError("A skill with this name already exists");

    const skill = await db.skill.create({
      data: { organisationId: session.user.organisationId, name: body.name },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "skill.create",
      entityType: "Skill",
      entityId: skill.id,
      after: { name: skill.name },
    });

    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
