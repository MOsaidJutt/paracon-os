import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { loadTenderConfig } from "@/lib/tenders/config";
import { buildImportPlan, commitImportPlan } from "@/lib/tenders/import";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("tender.edit");
    const db = getTenantContext(session.user.organisationId);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const config = await loadTenderConfig(session.user.organisationId);
    const plan = await buildImportPlan(buffer, db, config);
    const report = await commitImportPlan(plan, db, session.user.organisationId, config);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "tender.import",
      entityType: "Tender",
      after: report,
    });

    return NextResponse.json({ report });
  } catch (error) {
    return toErrorResponse(error);
  }
}
