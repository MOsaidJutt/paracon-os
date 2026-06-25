import { z } from "zod";

export const deliveryItemSchema = z.object({
  description: z.string().min(1).max(300),
  quantityOrdered: z.number().min(0).optional(),
  quantityReceived: z.number().min(0).optional(),
  unit: z.string().min(1).max(40).optional(),
});

export const createDeliverySchema = z.object({
  poId: z.string().min(1).optional().nullable(),
  supplierId: z.string().min(1).optional().nullable(),
  itemsJson: z.array(deliveryItemSchema).default([]),
  expectedDate: z.coerce.date().optional().nullable(),
  deliveredDate: z.coerce.date().optional().nullable(),
  status: z.string().min(1).default("Pending"),
});

export const updateDeliverySchema = createDeliverySchema.partial();

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryInput = z.infer<typeof updateDeliverySchema>;
