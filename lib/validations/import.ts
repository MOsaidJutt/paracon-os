import { z } from "zod";

export const zztakeoffColumnMapSchema = z.object({
  description: z.string().min(1),
  quantity: z.string().min(1),
  unit: z.string().min(1),
  unitRate: z.string().min(1).optional(),
  amount: z.string().min(1).optional(),
  remarks: z.string().min(1).optional(),
});

export const zztakeoffExtraSchema = z
  .object({
    columnMap: zztakeoffColumnMapSchema.optional(),
    targetProjectId: z.string().min(1).optional().nullable(),
    targetTenderId: z.string().min(1).optional().nullable(),
  })
  .refine((data) => !(data.targetProjectId && data.targetTenderId), {
    message: "Choose either a target project or a target tender, not both",
  });

export type ZztakeoffColumnMap = z.infer<typeof zztakeoffColumnMapSchema>;
export type ZztakeoffExtra = z.infer<typeof zztakeoffExtraSchema>;

export const contactsColumnMapSchema = z.object({
  // Client.name, or Supplier.company — "Company/Client name" in the wizard.
  name: z.string().min(1),
  // Supplier.trade only — required when contactType is "supplier".
  trade: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  contactName: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  mobile: z.string().min(1).optional(),
  comments: z.string().min(1).optional(),
});

export const contactsExtraSchema = z.object({
  contactType: z.enum(["client", "supplier"]).optional(),
  // Only meaningful when contactType is "supplier" — same record shape,
  // different Contacts-directory category (Supplier.kind).
  supplierKind: z.enum(["Supplier", "Subcontractor"]).optional(),
  columnMap: contactsColumnMapSchema.optional(),
});

export type ContactsColumnMap = z.infer<typeof contactsColumnMapSchema>;
export type ContactsExtra = z.infer<typeof contactsExtraSchema>;

/** Generic envelope for /api/import/[key]/preview and /commit — each importer validates its own `extra` shape. */
export const importPreviewBodySchema = z.object({
  extra: z.record(z.unknown()).optional(),
});

export const importCommitBodySchema = z.object({
  importJobId: z.string().min(1),
  extra: z.record(z.unknown()).optional(),
});
