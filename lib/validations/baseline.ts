import { z } from "zod";

export const createBaselineSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  note: z.string().max(500).optional().nullable(),
});

export type CreateBaselineInput = z.infer<typeof createBaselineSchema>;
