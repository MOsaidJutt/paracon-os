import { z } from "zod";

export const createSupplierBillSchema = z.object({
  projectId: z.string().min(1).optional().nullable(),
  supplierId: z.string().min(1).optional().nullable(),
  supplierNameRaw: z.string().max(200).optional().nullable(),
  poId: z.string().min(1).optional().nullable(),
  billFileId: z.string().min(1),
  invoiceNumber: z.string().max(100).optional().nullable(),
  invoiceDate: z.coerce.date().optional().nullable(),
  amountExGst: z.number().min(0),
  gstAmount: z.number().min(0).default(0),
  amountIncGst: z.number().min(0),
  jobNumberRaw: z.string().max(40).optional().nullable(),
});

/** Allocates an Unallocated bill to a project (and optionally a PO) — the tray's one-click action. */
export const allocateSupplierBillSchema = z.object({
  projectId: z.string().min(1),
  poId: z.string().min(1).optional().nullable(),
  supplierId: z.string().min(1).optional().nullable(),
});

/** The PM review checklist — four confirmations + an optional running note, saved as the review progresses. */
export const updateSupplierBillChecklistSchema = z.object({
  poId: z.string().min(1).optional().nullable(),
  supplierId: z.string().min(1).optional().nullable(),
  invoiceNumber: z.string().max(100).optional().nullable(),
  invoiceDate: z.coerce.date().optional().nullable(),
  amountExGst: z.number().min(0).optional(),
  gstAmount: z.number().min(0).optional(),
  amountIncGst: z.number().min(0).optional(),
  orderedConfirmed: z.boolean().optional(),
  receivedConfirmed: z.boolean().optional(),
  quantityConfirmed: z.boolean().optional(),
  priceConfirmed: z.boolean().optional(),
  reviewNote: z.string().max(2000).optional().nullable(),
});

export const billDecisionNoteSchema = z.object({
  note: z.string().min(1, "A note is required").max(2000),
});

export type CreateSupplierBillInput = z.infer<typeof createSupplierBillSchema>;
export type AllocateSupplierBillInput = z.infer<typeof allocateSupplierBillSchema>;
export type UpdateSupplierBillChecklistInput = z.infer<typeof updateSupplierBillChecklistSchema>;
export type BillDecisionNoteInput = z.infer<typeof billDecisionNoteSchema>;
