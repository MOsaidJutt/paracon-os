import { z } from "zod";

/** Creates the commercial ProgressClaim register row wrapping an already-generated Phase 7 GeneratedDocument. */
export const createProgressClaimCommercialSchema = z.object({
  generatedDocumentId: z.string().min(1),
  statDeclarationFileId: z.string().min(1).optional().nullable(),
});

export const attachStatDeclarationSchema = z.object({
  statDeclarationFileId: z.string().min(1),
});

export const decideProgressClaimSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
});

export const certifyProgressClaimSchema = z.object({
  certifiedAmount: z.number().min(0),
});

export const payProgressClaimSchema = z.object({
  paidAmount: z.number().min(0),
  paidAt: z.coerce.date().optional(),
});

export type CreateProgressClaimCommercialInput = z.infer<typeof createProgressClaimCommercialSchema>;
export type CertifyProgressClaimInput = z.infer<typeof certifyProgressClaimSchema>;
export type PayProgressClaimInput = z.infer<typeof payProgressClaimSchema>;
