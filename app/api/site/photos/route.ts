import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { uploadSitePhoto } from "@/lib/storage";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { assertInList } from "@/lib/config";
import { photoUploadFieldsSchema } from "@/lib/validations/site-update";
import { ensureDailyUpdateForCapture, assertNonEmptyFile } from "@/lib/site/daily-update-service";
import { loadSiteConfig } from "@/lib/site/config";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Captures one site photo independently of the day's final submit — get-or-
 * creates today's DailySiteUpdate so a photo can be taken before any
 * attendance/task data exists yet (e.g. the very first action of the day).
 * Idempotent on clientRef so an offline-queue retry never double-uploads.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("site.update");
    const db = getTenantContext(session.user.organisationId);

    const formData = await req.formData();
    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No photo file provided" }, { status: 400 });
    }
    const fields = photoUploadFieldsSchema.parse({
      projectId: formData.get("projectId"),
      date: formData.get("date"),
      caption: formData.get("caption") || undefined,
      tag: formData.get("tag"),
      clientRef: formData.get("clientRef") || undefined,
    });

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Photo must be PNG, JPEG, WebP or HEIC" }, { status: 400 });
    }
    assertNonEmptyFile(file.size, MAX_FILE_BYTES);

    const siteConfig = await loadSiteConfig(session.user.organisationId);
    assertInList(fields.tag, siteConfig.photoTagList, "tag");

    if (fields.clientRef) {
      const existing = await db.storedFile.findFirst({ where: { clientRef: fields.clientRef } });
      if (existing) return NextResponse.json({ storedFile: existing });
    }

    const dailyUpdate = await ensureDailyUpdateForCapture(
      db,
      session.user.organisationId,
      session.user.id,
      fields.projectId,
      fields.date
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadSitePhoto(session.user.organisationId, fields.projectId, buffer, file.name);

    const storedFile = await db.storedFile.create({
      data: {
        organisationId: session.user.organisationId,
        key: uploaded.key,
        name: file.name,
        mime: uploaded.mime,
        size: uploaded.size,
        category: "Site Photo",
        caption: fields.caption ?? null,
        clientRef: fields.clientRef ?? null,
        tagsJson: [fields.tag],
        projectId: fields.projectId,
        dailySiteUpdateId: dailyUpdate.id,
        uploadedByUserId: session.user.id,
      },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "site.photo.upload",
      entityType: "StoredFile",
      entityId: storedFile.id,
      after: { projectId: fields.projectId, tag: fields.tag },
    });

    return NextResponse.json({ storedFile }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
