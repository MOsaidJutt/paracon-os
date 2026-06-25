import { z } from "zod";

export const metricConfigSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  weight: z.number(),
  scaleMax: z.number().positive(),
  source: z.enum(["AUTO", "MANUAL"]),
});

export const configValueSchemas = {
  LIST: z.array(z.string().min(1)).min(1),
  NUMBER: z.number(),
  WEIGHTS: z.record(z.string(), z.number()),
  BANDS: z.array(z.object({ label: z.string().min(1), max: z.number().nullable() })),
  TEXT: z.string(),
  METRICS: z.array(metricConfigSchema).min(1),
} as const;

export type MetricConfig = z.infer<typeof metricConfigSchema>;

export type ConfigType = keyof typeof configValueSchemas;

export const updateConfigSchema = z.object({
  value: z.unknown(),
});
