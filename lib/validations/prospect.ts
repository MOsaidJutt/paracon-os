import { z } from "zod";

export const createProspectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  contactName: z.string().max(160).optional().nullable(),
  contactEmail: z.string().email().max(200).optional().nullable().or(z.literal("")),
  contactPhone: z.string().max(40).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  estimatedValue: z.number().min(0).optional().nullable(),
  stage: z.string().min(1, "Stage is required"),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateProspectSchema = createProspectSchema.partial();
