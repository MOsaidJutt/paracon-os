import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { updateProjectSchema } from "@/lib/validations/project";
import { assertInList, loadProjectConfig } from "@/lib/projects/config";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("project.view");
    const db = getTenantContext(session.user.organisationId);

    const project = await db.project.findFirst({
      where: { id: params.id },
      include: {
        client: { select: { id: true, name: true } },
        pmUser: { select: { id: true, name: true } },
        foremanUser: { select: { id: true, name: true } },
        sourceTender: { select: { id: true, projectName: true } },
        milestones: { orderBy: { date: "asc" } },
      },
    });
    if (!project) throw new NotFoundError("Project not found");

    return NextResponse.json({ project });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("project.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updateProjectSchema.parse(await req.json());

    const existing = await db.project.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Project not found");

    const config = await loadProjectConfig(session.user.organisationId);
    if (body.status) assertInList(body.status, config.statusList, "status");

    const startDate = body.startDate ?? existing.startDate;
    const endDate = body.endDate ?? existing.endDate;
    if (endDate < startDate) {
      return NextResponse.json({ error: "End date must be on or after the start date" }, { status: 400 });
    }

    if (body.clientId) {
      const client = await db.client.findFirst({ where: { id: body.clientId } });
      if (!client) return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }

    if (body.code) {
      const existingCode = await db.project.findFirst({ where: { code: body.code, id: { not: params.id } } });
      if (existingCode) return NextResponse.json({ error: "A project with this code already exists" }, { status: 400 });
    }

    const project = await db.project.update({
      where: { id: params.id },
      data: {
        name: body.name,
        code: body.code,
        address: body.address,
        status: body.status,
        value: body.value,
        startDate: body.startDate,
        endDate: body.endDate,
        clientId: body.clientId,
        pmUserId: body.pmUserId,
        foremanUserId: body.foremanUserId,
        tradePackages: body.tradePackages,
        costBudget: body.costBudget,
        scheduleColumnsJson: body.scheduleColumnsJson,
      },
      include: {
        client: { select: { id: true, name: true } },
        pmUser: { select: { id: true, name: true } },
        foremanUser: { select: { id: true, name: true } },
      },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "project.update",
      entityType: "Project",
      entityId: project.id,
      before: { status: existing.status, value: existing.value },
      after: { status: project.status, value: project.value },
    });

    return NextResponse.json({ project });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("project.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.project.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Project not found");

    await db.project.delete({ where: { id: params.id } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "project.delete",
      entityType: "Project",
      entityId: params.id,
      before: { name: existing.name, code: existing.code },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
