import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError, BadRequestError } from "@/lib/errors";
import { updateClientSchema } from "@/lib/validations/client";
import { loadTenderConfig } from "@/lib/tenders/config";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("tender.view");
    const db = getTenantContext(session.user.organisationId);

    const client = await db.client.findFirst({
      where: { id: params.id },
      include: { contacts: { orderBy: { name: "asc" } } },
    });
    if (!client) throw new NotFoundError("Client not found");

    return NextResponse.json({ client });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("tender.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updateClientSchema.parse(await req.json());

    const existing = await db.client.findFirst({ where: { id: params.id }, include: { contacts: true } });
    if (!existing) throw new NotFoundError("Client not found");

    if (body.status) {
      const config = await loadTenderConfig(session.user.organisationId);
      if (!config.clientStatusList.includes(body.status)) {
        throw new BadRequestError(`Invalid status "${body.status}". Must be one of: ${config.clientStatusList.join(", ")}`);
      }
    }

    if (body.contacts) {
      // ClientContact has no organisationId of its own (lib/tenant.ts treats it as
      // unscoped), so every id from the request must be checked against this
      // already-tenant-verified client's own contacts before we touch it.
      const existingContactIds = new Set(existing.contacts.map((c) => c.id));
      if (body.contacts.some((c) => c.id && !existingContactIds.has(c.id))) {
        throw new BadRequestError("One or more contacts do not belong to this client");
      }

      const keepIds = new Set(body.contacts.filter((c) => c.id).map((c) => c.id));
      const toDelete = existing.contacts.filter((c) => !keepIds.has(c.id));
      await db.clientContact.deleteMany({ where: { id: { in: toDelete.map((c) => c.id) } } });

      for (const contact of body.contacts) {
        const data = {
          name: contact.name,
          position: contact.position,
          email: contact.email || null,
          phone: contact.phone,
          mobile: contact.mobile,
        };
        if (contact.id) {
          await db.clientContact.update({ where: { id: contact.id }, data });
        } else {
          await db.clientContact.create({ data: { ...data, clientId: params.id } });
        }
      }
    }

    const client = await db.client.update({
      where: { id: params.id },
      data: { name: body.name, address: body.address, status: body.status },
      include: { contacts: { orderBy: { name: "asc" } } },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "client.update",
      entityType: "Client",
      entityId: client.id,
      before: { name: existing.name, status: existing.status },
      after: { name: client.name, status: client.status },
    });

    return NextResponse.json({ client });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("tender.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.client.findFirst({ where: { id: params.id }, include: { _count: { select: { tenders: true } } } });
    if (!existing) throw new NotFoundError("Client not found");
    if (existing._count.tenders > 0) {
      throw new BadRequestError("Cannot delete a client with tenders on file — reassign or remove those tenders first.");
    }

    await db.client.delete({ where: { id: params.id } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "client.delete",
      entityType: "Client",
      entityId: params.id,
      before: { name: existing.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
