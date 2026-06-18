import { z } from "zod";

export const PROVIDERS = ["openai", "anthropic", "google", "azure", "custom"] as const;

export const createAiSettingSchema = z.object({
  scope: z.enum(["GLOBAL", "ORG", "FEATURE"]),
  feature: z.string().min(1).max(60).optional().nullable(),
  provider: z.enum(PROVIDERS),
  model: z.string().min(1, "Model is required"),
  apiKey: z.string().min(1, "API key is required"),
  baseUrl: z.string().url().optional().nullable().or(z.literal("")),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(1).max(128_000),
  enabled: z.boolean(),
  monthlySpendCapUsd: z.number().min(0).optional().nullable(),
});

export const updateAiSettingSchema = z.object({
  feature: z.string().min(1).max(60).optional().nullable(),
  provider: z.enum(PROVIDERS).optional(),
  model: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(), // omit to keep existing key
  baseUrl: z.string().url().optional().nullable().or(z.literal("")),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128_000).optional(),
  enabled: z.boolean().optional(),
  monthlySpendCapUsd: z.number().min(0).optional().nullable(),
});

export type CreateAiSettingInput = z.infer<typeof createAiSettingSchema>;
export type UpdateAiSettingInput = z.infer<typeof updateAiSettingSchema>;
