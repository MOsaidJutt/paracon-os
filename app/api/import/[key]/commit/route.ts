import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { importCommitBodySchema } from "@/lib/validations/import";
import { commitImport } from "@/lib/import/jobs";

/** Commits a staged import job — idempotent: re-committing an already-COMMITTED job returns its stored report as a no-op. */
export async function POST(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    const session = await requirePermission("import.run");
    const db = getTenantContext(session.user.organisationId);
    const body = importCommitBodySchema.parse(await req.json());

    const result = await commitImport(db, session.user.organisationId, session.user.id, params.key, body.importJobId, body.extra);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "import.commit",
      entityType: "ImportJob",
      entityId: body.importJobId,
      after: { importerKey: params.key, alreadyImported: result.alreadyImported, report: result.report },
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
