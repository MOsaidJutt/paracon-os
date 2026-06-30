import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { createBaselineSchema } from "@/lib/validations/baseline";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("project.view");
    const db = getTenantContext(session.user.organisationId);

    const project = await db.project.findFirst({ where: { id: params.id } });
    if (!project) throw new NotFoundError("Project not found");

    const baselines = await db.baseline.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
      include: { savedBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ baselines });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Snapshots every current activity's dates into a new Baseline — the EOT-claim "original plan" reference. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("program.edit");
    const db = getTenantContext(session.user.organisationId);

    const project = await db.project.findFirst({ where: { id: params.id } });
    if (!project) throw new NotFoundError("Project not found");

    const body = createBaselineSchema.parse(await req.json());

    const activities = await db.programActivity.findMany({ where: { projectId: params.id } });

    const baseline = await db.baseline.create({
      data: {
        organisationId: session.user.organisationId,
        projectId: params.id,
        name: body.name,
        note: body.note,
        savedByUserId: session.user.id,
        tasks: {
          create: activities.map((a) => ({
            activityId: a.id,
            name: a.name,
            parentId: a.parentId,
            trade: a.trade,
            startDate: a.startDate,
            endDate: a.endDate,
          })),
        },
      },
      include: { tasks: true },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "baseline.create",
      entityType: "Baseline",
      entityId: baseline.id,
      after: { name: baseline.name, taskCount: baseline.tasks.length },
    });

    return NextResponse.json({ baseline }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
