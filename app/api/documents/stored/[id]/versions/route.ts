import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { ALLOWED_DOCUMENT_MIME_TYPES } from "@/lib/validations/document";
import { listVersions, requestNewVersionUploadUrl } from "@/lib/documents/service";

const requestVersionUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mime: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("doc.view");
    const db = getTenantContext(session.user.organisationId);
    const versions = await listVersions(db, params.id);
    return NextResponse.json({ versions });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Mints a presigned PUT URL for a NEW version of this document — commit at /versions/commit once the client has uploaded it. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("doc.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = requestVersionUploadSchema.parse(await req.json());

    const result = await requestNewVersionUploadUrl(db, session.user.organisationId, params.id, body.fileName, body.mime);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
