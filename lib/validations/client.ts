import { z } from "zod";

export const clientContactSchema = z.object({
  id: z.string().optional(), // present on an existing contact being edited, omitted when adding a new one
  name: z.string().min(1, "Name is required").max(120),
  position: z.string().max(120).optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().max(40).optional().nullable(),
  mobile: z.string().max(40).optional().nullable(),
});

export const createClientSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  address: z.string().max(300).optional().nullable(),
  status: z.string().min(1, "Status is required"),
  contacts: z.array(clientContactSchema).default([]),
});

export const updateClientSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  address: z.string().max(300).optional().nullable(),
  status: z.string().min(1).optional(),
  contacts: z.array(clientContactSchema).optional(),
});

export type ClientContactInput = z.infer<typeof clientContactSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
