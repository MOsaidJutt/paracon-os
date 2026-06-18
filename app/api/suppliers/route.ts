import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createSupplierSchema } from "@/lib/validations/supplier";

export async function GET() {
  try {
    const session = await requirePermission("tender.view");
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
