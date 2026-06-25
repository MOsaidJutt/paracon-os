import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createSupplierBillSchema } from "@/lib/validations/supplier-bill";
import { createSupplierBillManual, listSupplierBills } from "@/lib/finance/bill-review-service";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("finance.view");
    const db = getTenantContext(session.user.organisationId);

    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const allocationStatus = url.searchParams.get("allocationStatus") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;

    const bills = await listSupplierBills(db, { projectId, allocationStatus, status });
    return NextResponse.json({ bills });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("finance.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createSupplierBillSchema.parse(await req.json());

    const bill = await createSupplierBillManual(db, session.user.organisationId, body);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "supplier_bill.create",
      entityType: "SupplierBill",
      entityId: bill.id,
      after: { allocationStatus: bill.allocationStatus, amountIncGst: bill.amountIncGst },
    });

    return NextResponse.json({ bill }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
