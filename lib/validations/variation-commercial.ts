import { z } from "zod";

/** Creates the commercial Variation register row wrapping an already-generated Phase 7 GeneratedDocument. */
export const createVariationSchema = z.object({
  generatedDocumentId: z.string().min(1),
});

export const decideVariationSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
});

export type CreateVariationInput = z.infer<typeof createVariationSchema>;
export type DecideVariationInput = z.infer<typeof decideVariationSchema>;
