import { z } from "zod";

export const metricConfigSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  weight: z.number(),
  scaleMax: z.number().positive(),
  source: z.enum(["AUTO", "MANUAL"]),
});

export const checklistConfigItemSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  cadence: z.enum(["DAILY", "WEEKLY"]),
});

export const configValueSchemas = {
  LIST: z.array(z.string().min(1)).min(1),
  NUMBER: z.number(),
  WEIGHTS: z.record(z.string(), z.number()),
  BANDS: z.array(z.object({ label: z.string().min(1), max: z.number().nullable() })),
  TEXT: z.string(),
  METRICS: z.array(metricConfigSchema).min(1),
  // An org may legitimately clear its checklist entirely, so unlike METRICS
  // this one allows an empty array.
  CHECKLIST: z.array(checklistConfigItemSchema),
} as const;

export type MetricConfig = z.infer<typeof metricConfigSchema>;
export type ChecklistConfigItem = z.infer<typeof checklistConfigItemSchema>;

export type ConfigType = keyof typeof configValueSchemas;

export const updateConfigSchema = z.object({
  value: z.unknown(),
});
