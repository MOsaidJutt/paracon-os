import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError, BadRequestError } from "@/lib/errors";
import { createDependencySchema } from "@/lib/validations/dependency";
import { recomputeCriticalPath } from "@/lib/schedule/recompute";
import { topologicalOrder, DependencyCycleError, type DependencyType } from "@/lib/schedule/graph";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("project.view");
    const db = getTenantContext(session.user.organisationId);

    const project = await db.project.findFirst({ where: { id: params.id } });
    if (!project) throw new NotFoundError("Project not found");

    const dependencies = await db.dependency.findMany({
      where: { predecessor: { projectId: params.id } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ dependencies });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("program.edit");
    const db = getTenantContext(session.user.organisationId);

    const project = await db.project.findFirst({ where: { id: params.id } });
    if (!project) throw new NotFoundError("Project not found");

    const body = createDependencySchema.parse(await req.json());

    const [predecessor, successor] = await Promise.all([
      db.programActivity.findFirst({ where: { id: body.predecessorId, projectId: params.id } }),
      db.programActivity.findFirst({ where: { id: body.successorId, projectId: params.id } }),
    ]);
    if (!predecessor) throw new BadRequestError("Predecessor task not found in this project");
    if (!successor) throw new BadRequestError("Successor task not found in this project");

    const existingDuplicate = await db.dependency.findFirst({
      where: { predecessorId: body.predecessorId, successorId: body.successorId },
    });
    if (existingDuplicate) throw new BadRequestError("This dependency already exists");

    const [activities, existingDependencies] = await Promise.all([
      db.programActivity.findMany({ where: { projectId: params.id }, select: { id: true } }),
      db.dependency.findMany({
        where: { predecessor: { projectId: params.id } },
        select: { predecessorId: true, successorId: true, type: true, lagDays: true },
      }),
    ]);

    const candidateEdges = [
      ...existingDependencies.map((d) => ({
        predecessorId: d.predecessorId,
        successorId: d.successorId,
        type: d.type as DependencyType,
        lagDays: d.lagDays,
      })),
      { predecessorId: body.predecessorId, successorId: body.successorId, type: body.type, lagDays: body.lagDays },
    ];

    try {
      topologicalOrder(activities.map((a) => a.id), candidateEdges);
    } catch (error) {
      if (error instanceof DependencyCycleError) {
        throw new BadRequestError("This dependency would create a cycle in the schedule");
      }
      throw error;
    }

    const dependency = await db.dependency.create({
      data: {
        organisationId: session.user.organisationId,
        predecessorId: body.predecessorId,
        successorId: body.successorId,
        type: body.type,
        lagDays: body.lagDays,
      },
    });

    await recomputeCriticalPath(db, params.id);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "dependency.create",
      entityType: "Dependency",
      entityId: dependency.id,
      after: { predecessorId: dependency.predecessorId, successorId: dependency.successorId, type: dependency.type },
    });

    return NextResponse.json({ dependency }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
