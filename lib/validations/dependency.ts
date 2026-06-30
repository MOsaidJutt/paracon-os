import { z } from "zod";

export const dependencyTypeSchema = z.enum([
  "FINISH_TO_START",
  "START_TO_START",
  "FINISH_TO_FINISH",
  "START_TO_FINISH",
]);

export const createDependencySchema = z
  .object({
    predecessorId: z.string().min(1, "Predecessor is required"),
    successorId: z.string().min(1, "Successor is required"),
    type: dependencyTypeSchema.default("FINISH_TO_START"),
    lagDays: z.number().int().default(0),
  })
  .refine((data) => data.predecessorId !== data.successorId, {
    message: "A task cannot depend on itself",
    path: ["successorId"],
  });

export const updateDependencySchema = z.object({
  type: dependencyTypeSchema.optional(),
  lagDays: z.number().int().optional(),
});

export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
export type UpdateDependencyInput = z.infer<typeof updateDependencySchema>;
