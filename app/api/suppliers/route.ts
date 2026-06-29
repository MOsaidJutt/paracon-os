import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission, requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createSupplierSchema } from "@/lib/validations/supplier";
import { assertInList, loadSupplierConfig } from "@/lib/suppliers/config";

/** Read is shared with Finance (PO/delivery/bill forms) — a single Contacts source, gated for everyone who legitimately needs it. */
export async function GET() {
  try {
    const session = await requireAnyPermission(["tender.view", "finance.view"]);
    const db = getTenantContext(session.user.organisationId);

    const suppliers = await db.supplier.findMany({ orderBy: [{ trade: "asc" }, { company: "asc" }] });

    return NextResponse.json({ suppliers });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("tender.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createSupplierSchema.parse(await req.json());

    const config = await loadSupplierConfig(session.user.organisationId);
    assertInList(body.kind, config.kindList, "kind");

    const supplier = await db.supplier.create({
      data: { ...body, organisationId: session.user.organisationId, email: body.email || null },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "supplier.create",
      entityType: "Supplier",
      entityId: supplier.id,
      after: { company: supplier.company, trade: supplier.trade },
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
