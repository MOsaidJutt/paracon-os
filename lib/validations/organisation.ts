import { z } from "zod";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const createOrganisationSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  slug: z.string().min(2).max(60).regex(slugPattern, "Lowercase letters, numbers and hyphens only"),
  adminEmail: z.string().email("Enter a valid email"),
});

export const updateOrganisationSchema = z.object({
  isActive: z.boolean().optional(),
});

export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;
export type UpdateOrganisationInput = z.infer<typeof updateOrganisationSchema>;
