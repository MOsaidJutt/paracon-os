import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { uploadLogo } from "@/lib/storage";
import { getConfig } from "@/lib/config";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function GET() {
  try {
    const session = await requirePermission("admin.branding");

    const [organisation, allowedSwatches] = await Promise.all([
      prisma.organisation.findUniqueOrThrow({
        where: { id: session.user.organisationId },
        select: { name: true, logoUrl: true, primaryColor: true, legalName: true, abn: true, registeredAddress: true },
      }),
      getConfig<string[]>("branding.accentSwatches", session.user.organisationId),
    ]);

    return NextResponse.json({ organisation, allowedSwatches });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("admin.branding");

    const formData = await req.formData();
    const file = formData.get("logo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No logo file provided" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Logo must be PNG, JPEG or WebP" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Logo must be under 5MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const logoUrl = await uploadLogo(session.user.organisationId, buffer);

    await prisma.organisation.update({
      where: { id: session.user.organisationId },
      data: { logoUrl },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "branding.logo_update",
      entityType: "Organisation",
      entityId: session.user.organisationId,
    });

    return NextResponse.json({ logoUrl });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const patchSchema = z.object({
  primaryColor: z.string().optional(),
  legalName: z.string().min(1).max(200).optional(),
  abn: z.string().min(1).max(30).optional(),
  registeredAddress: z.string().min(1).max(300).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await requirePermission("admin.branding");
    const body = patchSchema.parse(await req.json());

    // Server-side enforced guardrail — the swatch list is a Config entry,
    // not a free colour picker, so a direct API call can't bypass it either.
    if (body.primaryColor !== undefined) {
      const allowedSwatches = await getConfig<string[]>("branding.accentSwatches", session.user.organisationId);
      if (!allowedSwatches.includes(body.primaryColor)) {
        return NextResponse.json({ error: "That colour isn't one of the approved brand swatches" }, { status: 400 });
      }
    }

    const before = await prisma.organisation.findUniqueOrThrow({ where: { id: session.user.organisationId } });

    await prisma.organisation.update({
      where: { id: session.user.organisationId },
      data: {
        primaryColor: body.primaryColor,
        legalName: body.legalName,
        abn: body.abn,
        registeredAddress: body.registeredAddress,
      },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "branding.update",
      entityType: "Organisation",
      entityId: session.user.organisationId,
      before: { primaryColor: before.primaryColor, legalName: before.legalName, abn: before.abn, registeredAddress: before.registeredAddress },
      after: body,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
