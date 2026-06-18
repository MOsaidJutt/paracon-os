import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createAiSettingSchema } from "@/lib/validations/ai-setting";

export async function GET() {
  try {
    const session = await requirePermission("admin.ai");

    const settings = await prisma.aiSetting.findMany({
      where: { OR: [{ scope: "GLOBAL" }, { organisationId: session.user.organisationId }] },
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

    const organisationId = body.scope === "GLOBAL" ? null : session.user.organisationId;
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
