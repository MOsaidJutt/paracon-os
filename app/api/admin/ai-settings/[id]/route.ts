import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { updateAiSettingSchema } from "@/lib/validations/ai-setting";

async function findScopedSetting(id: string, organisationId: string) {
  return prisma.aiSetting.findFirst({
    where: { id, OR: [{ scope: "GLOBAL" }, { organisationId }] },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("admin.ai");
    const before = await findScopedSetting(params.id, session.user.organisationId);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = updateAiSettingSchema.parse(await req.json());
    const data: Record<string, unknown> = { updatedBy: session.user.id };
    if (body.feature !== undefined) data.feature = body.feature;
    if (body.provider !== undefined) data.provider = body.provider;
    if (body.model !== undefined) data.model = body.model;
    if (body.apiKey) data.apiKeyEncrypted = encrypt(body.apiKey);
    if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl || null;
    if (body.temperature !== undefined) data.temperature = body.temperature;
    if (body.maxTokens !== undefined) data.maxTokens = body.maxTokens;
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.monthlySpendCapUsd !== undefined) data.monthlySpendCapUsd = body.monthlySpendCapUsd;

    const setting = await prisma.aiSetting.update({ where: { id: params.id }, data });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "ai_setting.update",
      entityType: "AiSetting",
      entityId: setting.id,
      before: { provider: before.provider, model: before.model, enabled: before.enabled },
      after: { provider: setting.provider, model: setting.model, enabled: setting.enabled },
    });

    const { apiKeyEncrypted, ...rest } = setting;
    return NextResponse.json({ setting: { ...rest, hasKey: !!apiKeyEncrypted } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("admin.ai");
    const before = await findScopedSetting(params.id, session.user.organisationId);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.aiSetting.delete({ where: { id: params.id } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "ai_setting.delete",
      entityType: "AiSetting",
      entityId: before.id,
      before: { scope: before.scope, provider: before.provider, model: before.model },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
