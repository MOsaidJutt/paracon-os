import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createAiSettingSchema } from "@/lib/validations/ai-setting";

// Org admins (admin.ai) only ever see/manage their own ORG/FEATURE rows here.
// The platform-wide GLOBAL row is managed exclusively under
// /api/super-admin/ai-defaults by platform.superadmin — letting any org
// admin touch GLOBAL would let them change the AI provider/key for every
// tenant on the platform.
export async function GET() {
  try {
    const session = await requirePermission("admin.ai");

    const settings = await prisma.aiSetting.findMany({
      where: { organisationId: session.user.organisationId, scope: { in: ["ORG", "FEATURE"] } },
      orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      settings: settings.map(({ apiKeyEncrypted, ...rest }) => ({ ...rest, hasKey: !!apiKeyEncrypted })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("admin.ai");
    const body = createAiSettingSchema.parse(await req.json());

    if (body.scope === "GLOBAL") {
      return NextResponse.json(
        { error: "GLOBAL settings are managed by a super admin" },
        { status: 403 }
      );
    }

    const organisationId = session.user.organisationId;
    const feature = body.scope === "FEATURE" ? body.feature ?? null : null;

    if (body.scope === "FEATURE" && !feature) {
      return NextResponse.json({ error: "Feature key is required for FEATURE scope" }, { status: 400 });
    }

    const duplicate = await prisma.aiSetting.findFirst({
      where: { scope: body.scope, organisationId, feature },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "A setting for this scope already exists — edit it instead of creating another." },
        { status: 400 }
      );
    }

    const setting = await prisma.aiSetting.create({
      data: {
        scope: body.scope,
        organisationId,
        feature,
        provider: body.provider,
        model: body.model,
        apiKeyEncrypted: encrypt(body.apiKey),
        baseUrl: body.baseUrl || null,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        enabled: body.enabled,
        monthlySpendCapUsd: body.monthlySpendCapUsd ?? null,
        updatedBy: session.user.id,
      },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "ai_setting.create",
      entityType: "AiSetting",
      entityId: setting.id,
      after: { scope: setting.scope, provider: setting.provider, model: setting.model, feature: setting.feature },
    });

    const { apiKeyEncrypted, ...rest } = setting;
    return NextResponse.json({ setting: { ...rest, hasKey: !!apiKeyEncrypted } }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
