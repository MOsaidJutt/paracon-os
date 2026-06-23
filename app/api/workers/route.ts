import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createWorkerSchema, listWorkersQuerySchema } from "@/lib/validations/worker";
import { assertInList, loadLabourConfig } from "@/lib/labour/config";
import { sendEvent } from "@/lib/inngest/send-safe";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("labour.view");
    const db = getTenantContext(session.user.organisationId);

    const params = req.nextUrl.searchParams;
    const query = listWorkersQuerySchema.parse({
      capability: params.getAll("capability").length > 0 ? params.getAll("capability") : undefined,
      status: params.getAll("status").length > 0 ? params.getAll("status") : undefined,
      compliance: params.getAll("compliance").length > 0 ? params.getAll("compliance") : undefined,
      search: params.get("search") ?? undefined,
    });

    const workers = await db.worker.findMany({
      where: {
        capability: query.capability ? { in: query.capability } : undefined,
        status: query.status ? { in: query.status } : undefined,
        name: query.search ? { contains: query.search } : undefined,
        compliance: query.compliance ? { some: { status: { in: query.compliance } } } : undefined,
      },
      include: {
        performance: true,
        compliance: { orderBy: { expiryDate: "asc" } },
        skills: { include: { skill: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ workers });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("worker.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createWorkerSchema.parse(await req.json());

    const config = await loadLabourConfig(session.user.organisationId);
    assertInList(body.capability, config.capabilityList, "capability");
    assertInList(body.employmentType, config.employmentTypeList, "employmentType");
    if (body.status) assertInList(body.status, config.statusList, "status");

    const worker = await db.worker.create({
      data: {
        organisationId: session.user.organisationId,
        name: body.name,
        phone: body.phone,
        capability: body.capability,
        employmentType: body.employmentType,
        status: body.status ?? "Available",
        baseLocation: body.baseLocation,
        performance: { create: {} },
      },
      include: { performance: true },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "worker.create",
      entityType: "Worker",
      entityId: worker.id,
      after: { name: worker.name, capability: worker.capability },
    });
    await sendEvent("forecast/recompute.requested");

    return NextResponse.json({ worker }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
