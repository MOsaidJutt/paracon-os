import { z } from "zod";

export const createSupplierSchema = z.object({
  trade: z.string().min(1, "Trade is required").max(80),
  company: z.string().min(1, "Company is required").max(160),
  contact: z.string().max(120).optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().max(40).optional().nullable(),
  comments: z.string().max(500).optional().nullable(),
  kind: z.string().min(1, "Kind is required"),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
