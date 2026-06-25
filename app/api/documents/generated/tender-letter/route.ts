import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { generateTenderLetterSchema } from "@/lib/validations/generated-document";
import { generateTenderLetter } from "@/lib/documents/generation-service";

/** Generates a Tender Letter PDF + Excel for a tender, auto-numbered. Margin/rounding/GST all read from the org's Config (variable, never hard-coded). */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("doc.generate");
    const db = getTenantContext(session.user.organisationId);

    const input = generateTenderLetterSchema.parse(await req.json());
    const document = await generateTenderLetter(db, session.user.organisationId, session.user.id, input);

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
