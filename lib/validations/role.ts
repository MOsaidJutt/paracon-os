import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
  permissionSlugs: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  permissionSlugs: z.array(z.string()).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
