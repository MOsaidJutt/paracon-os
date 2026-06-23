import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { uploadWorkerPhoto } from "@/lib/storage";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("worker.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.worker.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Worker not found");

    const formData = await req.formData();
    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No photo file provided" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Photo must be PNG, JPEG or WebP" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Photo must be under 5MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const photoUrl = await uploadWorkerPhoto(session.user.organisationId, params.id, buffer);

    const worker = await db.worker.update({ where: { id: params.id }, data: { photoUrl } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "worker.photo_update",
      entityType: "Worker",
      entityId: worker.id,
    });

    return NextResponse.json({ worker });
  } catch (error) {
    return toErrorResponse(error);
  }
}
