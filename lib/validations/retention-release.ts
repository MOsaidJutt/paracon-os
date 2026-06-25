import { z } from "zod";

export const createRetentionReleaseSchema = z.object({
  projectId: z.string().min(1),
  amount: z.number().positive(),
  type: z.string().min(1).default("PracticalCompletion"),
  note: z.string().max(2000).optional().nullable(),
});

export type CreateRetentionReleaseInput = z.infer<typeof createRetentionReleaseSchema>;
