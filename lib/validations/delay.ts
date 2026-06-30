import { z } from "zod";

const isoDate = z.coerce.date();

export const previewMoveSchema = z.object({
  startDate: isoDate,
  endDate: isoDate,
});

export const commitMoveSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    reason: z.string().optional(),
    note: z.string().max(500).optional().nullable(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export type PreviewMoveInput = z.infer<typeof previewMoveSchema>;
export type CommitMoveInput = z.infer<typeof commitMoveSchema>;
