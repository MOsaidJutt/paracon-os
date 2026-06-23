import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { uploadComplianceDoc } from "@/lib/storage";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: { id: string; complianceId: string } }) {
  try {
    const session = await requirePermission("compliance.manage");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.compliance.findFirst({ where: { id: params.complianceId, workerId: params.id } });
    if (!existing) throw new NotFoundError("Compliance record not found");

    const formData = await req.formData();
    const file = formData.get("doc");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No document provided" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Document must be PNG, JPEG, WebP or PDF" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Document must be under 10MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const docUrl = await uploadComplianceDoc(
      session.user.organisationId,
      params.id,
      params.complianceId,
      buffer,
      file.type,
      file.name
    );

    const compliance = await db.compliance.update({ where: { id: params.complianceId }, data: { docUrl } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "compliance.doc_upload",
      entityType: "Compliance",
      entityId: compliance.id,
    });

    return NextResponse.json({ compliance });
  } catch (error) {
    return toErrorResponse(error);
  }
}
