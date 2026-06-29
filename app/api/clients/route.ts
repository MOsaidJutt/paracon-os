import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission, requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError } from "@/lib/errors";
import { createClientSchema } from "@/lib/validations/client";
import { loadTenderConfig } from "@/lib/tenders/config";

/** Read is shared with Projects (project setup) — a single Contacts source, gated for everyone who legitimately needs it. */
export async function GET() {
  try {
    const session = await requireAnyPermission(["tender.view", "project.view", "finance.view"]);
    const db = getTenantContext(session.user.organisationId);

    const clients = await db.client.findMany({
      orderBy: { name: "asc" },
      include: { contacts: { orderBy: { name: "asc" } }, _count: { select: { tenders: true } } },
    });

    return NextResponse.json({ clients });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("tender.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createClientSchema.parse(await req.json());

    const config = await loadTenderConfig(session.user.organisationId);
    if (!config.clientStatusList.includes(body.status)) {
      throw new BadRequestError(`Invalid status "${body.status}". Must be one of: ${config.clientStatusList.join(", ")}`);
    }

    const existing = await db.client.findFirst({ where: { name: body.name } });
    if (existing) {
      return NextResponse.json({ error: "A client with this name already exists" }, { status: 400 });
    }

    const client = await db.client.create({
      data: {
        organisationId: session.user.organisationId,
        name: body.name,
        address: body.address,
        status: body.status,
        contacts: { create: body.contacts.map((c) => ({ name: c.name, position: c.position, email: c.email || null, phone: c.phone, mobile: c.mobile })) },
      },
      include: { contacts: true },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "client.create",
      entityType: "Client",
      entityId: client.id,
      after: { name: client.name, status: client.status },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
