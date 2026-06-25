import { z } from "zod";

export const createAllocationSchema = z.object({
  workerId: z.string().min(1, "Worker is required"),
  projectId: z.string().min(1, "Project is required"),
  weekStart: z.coerce.date(),
});

export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
