import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { generateSwmsSchema } from "@/lib/validations/generated-document";
import { generateSwms } from "@/lib/documents/generation-service";

/** Generates a Safe Work Method Statement PDF for a project, auto-numbered per project. Enter-once: project/address/client/PM/site manager all pulled from the Project record. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("doc.generate");
    const db = getTenantContext(session.user.organisationId);

    const input = generateSwmsSchema.parse(await req.json());
    const document = await generateSwms(db, session.user.organisationId, session.user.id, input);

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
