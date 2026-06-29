import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { loadSupplierConfig } from "@/lib/suppliers/config";

/** Exposes the Config-driven kind list (Supplier/Subcontractor) the supplier form's dropdown needs. */
export async function GET() {
  try {
    const session = await requireAnyPermission(["tender.view", "finance.view"]);
    const config = await loadSupplierConfig(session.user.organisationId);
    return NextResponse.json(config);
  } catch (error) {
    return toErrorResponse(error);
  }
}
