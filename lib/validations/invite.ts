import { z } from "zod";

export const createInviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  roleId: z.string().min(1, "Role is required"),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1, "Name is required").max(120),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
