import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";

export class AiNotConfiguredError extends Error {
  constructor(feature: string) {
    super(`No enabled AI setting found for feature "${feature}" (checked FEATURE -> ORG -> GLOBAL)`);
    this.name = "AiNotConfiguredError";
  }
}

export interface ResolvedAiSetting {
  id: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string | null;
  temperature: number;
  maxTokens: number;
  monthlySpendCapUsd: number | null;
  organisationId: string | null;
}

/** Resolves the most specific enabled AiSetting row: FEATURE -> ORG -> GLOBAL. */
export async function resolveAiSetting(
  feature: string,
  organisationId: string
): Promise<ResolvedAiSetting> {
  const featureSetting = await prisma.aiSetting.findFirst({
    where: { scope: "FEATURE", feature, organisationId, enabled: true },
    orderBy: { createdAt: "desc" },
  });
  const orgSetting =
    featureSetting ??
    (await prisma.aiSetting.findFirst({
      where: { scope: "ORG", organisationId, enabled: true },
      orderBy: { createdAt: "desc" },
    }));
  const setting =
    orgSetting ??
    (await prisma.aiSetting.findFirst({
      where: { scope: "GLOBAL", enabled: true },
      orderBy: { createdAt: "desc" },
    }));

  if (!setting) throw new AiNotConfiguredError(feature);

  return {
    id: setting.id,
    provider: setting.provider,
    model: setting.model,
    apiKey: decrypt(setting.apiKeyEncrypted),
    baseUrl: setting.baseUrl,
    temperature: setting.temperature,
    maxTokens: setting.maxTokens,
    monthlySpendCapUsd: setting.monthlySpendCapUsd,
    organisationId: setting.organisationId,
  };
}

/** Returns a configured Vercel AI SDK chat model for the given feature + org. */
export async function getAiClient(
  feature: string,
  organisationId: string
): Promise<{ model: LanguageModel; setting: ResolvedAiSetting }> {
  const setting = await resolveAiSetting(feature, organisationId);

  switch (setting.provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: setting.apiKey,
        baseURL: setting.baseUrl ?? undefined,
      });
      return { model: openai(setting.model), setting };
    }
    default:
      throw new Error(`Unsupported AI provider: ${setting.provider}`);
  }
}

function buildModel(provider: string, model: string, apiKey: string, baseUrl: string | null): LanguageModel {
  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey, baseURL: baseUrl ?? undefined });
      return openai(model);
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

export interface TestAiSettingResult {
  ok: boolean;
  latencyMs: number;
  completionTokens?: number;
  promptTokens?: number;
  error?: string;
}

/**
 * Sends a minimal completion request through the given AiSetting row to
 * verify the provider/model/key combination works. Logs the attempt to
 * AiUsageLog regardless of outcome.
 *
 * `organisationId: null` means "GLOBAL row, super admin caller" — org
 * admins (non-null organisationId) can only test their own ORG/FEATURE
 * rows, never the platform-wide GLOBAL setting.
 */
export async function testAiSetting(
  settingId: string,
  organisationId: string | null
): Promise<TestAiSettingResult> {
  const setting = await prisma.aiSetting.findFirst({
    where:
      organisationId === null
        ? { id: settingId, scope: "GLOBAL" }
        : { id: settingId, organisationId, scope: { in: ["ORG", "FEATURE"] } },
  });
  if (!setting) throw new Error("AI setting not found");

  const started = Date.now();
  try {
    const apiKey = decrypt(setting.apiKeyEncrypted);
    const model = buildModel(setting.provider, setting.model, apiKey, setting.baseUrl);

    const result = await generateText({
      model,
      prompt: "Reply with the single word: OK",
      maxOutputTokens: 10,
    });

    const latencyMs = Date.now() - started;
    await prisma.aiUsageLog.create({
      data: {
        organisationId: setting.organisationId,
        feature: "test_connection",
        provider: setting.provider,
        model: setting.model,
        promptTokens: result.usage?.inputTokens ?? 0,
        completionTokens: result.usage?.outputTokens ?? 0,
        latencyMs,
        success: true,
      },
    });

    return {
      ok: true,
      latencyMs,
      promptTokens: result.usage?.inputTokens,
      completionTokens: result.usage?.outputTokens,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const message = error instanceof Error ? error.message : "Unknown error";

    await prisma.aiUsageLog.create({
      data: {
        organisationId: setting.organisationId,
        feature: "test_connection",
        provider: setting.provider,
        model: setting.model,
        latencyMs,
        success: false,
        error: message,
      },
    });

    return { ok: false, latencyMs, error: message };
  }
}
