import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { billDecisionNoteSchema } from "@/lib/validations/supplier-bill";
import { rejectVariation } from "@/lib/finance/variation-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.approve");
    const db = getTenantContext(session.user.organisationId);
    const body = billDecisionNoteSchema.parse(await req.json());

    const variation = await rejectVariation(db, session.user.organisationId, session.user.id, params.id, body.note);
    return NextResponse.json({ variation });
  } catch (error) {
    return toErrorResponse(error);
  }
}
