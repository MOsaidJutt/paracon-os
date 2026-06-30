import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createProjectSchema, listProjectsQuerySchema } from "@/lib/validations/project";
import { assertInList, loadProjectConfig } from "@/lib/projects/config";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("project.view");
    const db = getTenantContext(session.user.organisationId);

    const params = req.nextUrl.searchParams;
    const query = listProjectsQuerySchema.parse({
      status: params.getAll("status").length > 0 ? params.getAll("status") : undefined,
      clientId: params.get("clientId") ?? undefined,
      search: params.get("search") ?? undefined,
      sortBy: params.get("sortBy") ?? undefined,
      sortDir: params.get("sortDir") ?? undefined,
      hasLabour: params.get("hasLabour") ?? undefined,
    });

    const projects = await db.project.findMany({
      where: {
        status: query.status ? { in: query.status } : undefined,
        clientId: query.clientId,
        name: query.search ? { contains: query.search } : undefined,
        // Only include projects that have at least one activity with labour
        // requirements set — used by the Resource Planner dropdown so test
        // projects with empty activities don't appear as the default.
        ...(query.hasLabour
          ? { activities: { some: { NOT: { labourRequired: { equals: {} } } } } }
          : {}),
      },
      orderBy: { [query.sortBy]: query.sortDir },
      include: {
        client: { select: { id: true, name: true } },
        pmUser: { select: { id: true, name: true } },
        foremanUser: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("project.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createProjectSchema.parse(await req.json());

    const config = await loadProjectConfig(session.user.organisationId);
    assertInList(body.status, config.statusList, "status");

    if (body.endDate < body.startDate) {
      return NextResponse.json({ error: "End date must be on or after the start date" }, { status: 400 });
    }

    const client = await db.client.findFirst({ where: { id: body.clientId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 400 });

    const existingCode = await db.project.findFirst({ where: { code: body.code } });
    if (existingCode) return NextResponse.json({ error: "A project with this code already exists" }, { status: 400 });

    const project = await db.project.create({
      data: {
        organisationId: session.user.organisationId,
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
      action: "project.create",
      entityType: "Project",
      entityId: project.id,
      after: { name: project.name, code: project.code, status: project.status, value: project.value },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
