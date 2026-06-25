import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import {
  regenerateProgressClaimSchema,
  regenerateTenderLetterSchema,
  regenerateVariationSchema,
} from "@/lib/validations/generated-document";
import {
  regenerateProgressClaim,
  regenerateTenderLetter,
  regenerateVariation,
} from "@/lib/documents/generation-service";

/** Re-renders a generated document under the SAME number with a new version — used to fix a typo or reflect an updated input without re-keying the number/sequence. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("doc.generate");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.generatedDocument.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Generated document not found");

    const body = await req.json();
    const document =
      existing.type === "VARIATION"
        ? await regenerateVariation(db, session.user.organisationId, session.user.id, existing.id, regenerateVariationSchema.parse(body))
        : existing.type === "PROGRESS_CLAIM"
          ? await regenerateProgressClaim(
              db,
              session.user.organisationId,
              session.user.id,
              existing.id,
              regenerateProgressClaimSchema.parse(body)
            )
          : await regenerateTenderLetter(
              db,
              session.user.organisationId,
              session.user.id,
              existing.id,
              regenerateTenderLetterSchema.parse(body)
            );

    return NextResponse.json({ document });
  } catch (error) {
    return toErrorResponse(error);
  }
}
