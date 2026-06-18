import { z } from "zod";

export const configValueSchemas = {
  LIST: z.array(z.string().min(1)).min(1),
  NUMBER: z.number(),
  WEIGHTS: z.record(z.string(), z.number()),
  BANDS: z.array(z.object({ label: z.string().min(1), max: z.number().nullable() })),
} as const;

export type ConfigType = keyof typeof configValueSchemas;

export const updateConfigSchema = z.object({
  value: z.unknown(),
});
