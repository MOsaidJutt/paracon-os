import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { updateSupplierSchema } from "@/lib/validations/supplier";
import { assertInList, loadSupplierConfig } from "@/lib/suppliers/config";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("tender.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updateSupplierSchema.parse(await req.json());

    const existing = await db.supplier.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Supplier not found");

    if (body.kind) {
      const config = await loadSupplierConfig(session.user.organisationId);
      assertInList(body.kind, config.kindList, "kind");
    }

    const supplier = await db.supplier.update({
      where: { id: params.id },
      data: { ...body, email: body.email === "" ? null : body.email },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "supplier.update",
      entityType: "Supplier",
      entityId: supplier.id,
      before: { company: existing.company },
      after: { company: supplier.company },
    });

    return NextResponse.json({ supplier });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("tender.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.supplier.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Supplier not found");

    await db.supplier.delete({ where: { id: params.id } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "supplier.delete",
      entityType: "Supplier",
      entityId: params.id,
      before: { company: existing.company },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
