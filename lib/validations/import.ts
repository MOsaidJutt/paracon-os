import { z } from "zod";

export const zztakeoffColumnMapSchema = z.object({
  description: z.string().min(1),
  quantity: z.string().min(1),
  unit: z.string().min(1),
  unitRate: z.string().min(1).optional(),
  amount: z.string().min(1).optional(),
  remarks: z.string().min(1).optional(),
});

export const zztakeoffExtraSchema = z
  .object({
    columnMap: zztakeoffColumnMapSchema.optional(),
    targetProjectId: z.string().min(1).optional().nullable(),
    targetTenderId: z.string().min(1).optional().nullable(),
  })
  .refine((data) => !(data.targetProjectId && data.targetTenderId), {
    message: "Choose either a target project or a target tender, not both",
  });

export type ZztakeoffColumnMap = z.infer<typeof zztakeoffColumnMapSchema>;
export type ZztakeoffExtra = z.infer<typeof zztakeoffExtraSchema>;

/** Generic envelope for /api/import/[key]/preview and /commit — each importer validates its own `extra` shape. */
export const importPreviewBodySchema = z.object({
  extra: z.record(z.unknown()).optional(),
});

export const importCommitBodySchema = z.object({
  importJobId: z.string().min(1),
  extra: z.record(z.unknown()).optional(),
});
