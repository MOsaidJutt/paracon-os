import { z } from "zod";

export const purchaseOrderItemSchema = z.object({
  description: z.string().min(1).max(300),
  quantity: z.number().min(0),
  unit: z.string().min(1).max(40),
  unitRate: z.number().min(0),
  amount: z.number().min(0),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1).optional().nullable(),
  itemsJson: z.array(purchaseOrderItemSchema).default([]),
  value: z.number().min(0),
  expectedDate: z.coerce.date().optional().nullable(),
  status: z.string().min(1).default("Draft"),
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema.partial();

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
