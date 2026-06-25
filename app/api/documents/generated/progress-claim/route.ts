import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { generateProgressClaimSchema } from "@/lib/validations/generated-document";
import { generateProgressClaim } from "@/lib/documents/generation-service";

/** Generates a Progress Claim PDF + Excel for a project, auto-numbered per project. "Previously Claimed" is auto-carried from the prior claim — never re-typed. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("doc.generate");
    const db = getTenantContext(session.user.organisationId);

    const input = generateProgressClaimSchema.parse(await req.json());
    const document = await generateProgressClaim(db, session.user.organisationId, session.user.id, input);

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
