import { z } from "zod";

/** "YYYY-MM" query/body param — coerced to the first of that month, UTC midnight. */
export const monthParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM")
  .transform((value) => new Date(`${value}-01T00:00:00.000Z`));

export const saveScoreSchema = z.object({
  period: monthParamSchema,
  metricScores: z.record(z.string(), z.number()),
  note: z.string().max(2000).optional().nullable(),
});

export const monthQuerySchema = z.object({
  period: monthParamSchema,
});

export type SaveScoreInput = z.infer<typeof saveScoreSchema>;
