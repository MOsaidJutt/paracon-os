import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createAiSettingSchema } from "@/lib/validations/ai-setting";

// Platform-wide GLOBAL AiSetting rows — the fallback every org resolves to
// when it has no ORG/FEATURE override. super-admin-only.
export async function GET() {
  try {
    await requirePermission("platform.superadmin");

    const settings = await prisma.aiSetting.findMany({
      where: { scope: "GLOBAL" },
      orderBy: { createdAt: "asc" },
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
    const session = await requirePermission("platform.superadmin");
    const body = createAiSettingSchema.parse(await req.json());

    if (body.scope !== "GLOBAL") {
      return NextResponse.json({ error: "This endpoint only manages GLOBAL settings" }, { status: 400 });
    }

    const duplicate = await prisma.aiSetting.findFirst({ where: { scope: "GLOBAL" } });
    if (duplicate) {
      return NextResponse.json(
        { error: "A GLOBAL setting already exists — edit it instead of creating another." },
        { status: 400 }
      );
    }

    const setting = await prisma.aiSetting.create({
      data: {
        scope: "GLOBAL",
        organisationId: null,
        feature: null,
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
      organisationId: null,
      userId: session.user.id,
      action: "ai_setting.create",
      entityType: "AiSetting",
      entityId: setting.id,
      after: { scope: "GLOBAL", provider: setting.provider, model: setting.model },
    });

    const { apiKeyEncrypted, ...rest } = setting;
    return NextResponse.json({ setting: { ...rest, hasKey: !!apiKeyEncrypted } }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
