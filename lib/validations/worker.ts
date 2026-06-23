import { z } from "zod";

const isoDate = z.coerce.date();

export const createWorkerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  phone: z.string().max(40).optional().nullable(),
  capability: z.string().min(1, "Capability is required"),
  employmentType: z.string().min(1, "Employment type is required"),
  status: z.string().min(1).optional(),
  baseLocation: z.string().max(200).optional().nullable(),
});

export const updateWorkerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(40).optional().nullable(),
  capability: z.string().min(1).optional(),
  employmentType: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  baseLocation: z.string().max(200).optional().nullable(),
});

export const listWorkersQuerySchema = z.object({
  capability: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  compliance: z.array(z.string()).optional(),
  search: z.string().optional(),
});

export const updatePerformanceSchema = z.object({
  quality: z.number().min(0).max(5),
  reliability: z.number().min(0).max(5),
  productivity: z.number().min(0).max(5),
  safety: z.number().min(0).max(5),
});

export const createComplianceSchema = z
  .object({
    type: z.string().min(1, "Type is required"),
    reference: z.string().max(200).optional().nullable(),
    issuedDate: isoDate.optional().nullable(),
    expiryDate: isoDate.optional().nullable(),
  })
  .refine((data) => !data.issuedDate || !data.expiryDate || data.expiryDate >= data.issuedDate, {
    message: "Expiry date must be on or after the issued date",
    path: ["expiryDate"],
  });

export const updateComplianceSchema = z
  .object({
    type: z.string().min(1).optional(),
    reference: z.string().max(200).optional().nullable(),
    issuedDate: isoDate.optional().nullable(),
    expiryDate: isoDate.optional().nullable(),
  })
  .refine((data) => !data.issuedDate || !data.expiryDate || data.expiryDate >= data.issuedDate, {
    message: "Expiry date must be on or after the issued date",
    path: ["expiryDate"],
  });

export const upsertWorkerSkillsSchema = z.object({
  skills: z.array(
    z.object({
      skillId: z.string().min(1),
      level: z.number().int().min(1).max(5),
    })
  ),
});

export const createSkillSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

export const createLeaveSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    reason: z.string().max(200).optional().nullable(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export type CreateWorkerInput = z.infer<typeof createWorkerSchema>;
export type UpdateWorkerInput = z.infer<typeof updateWorkerSchema>;
export type ListWorkersQuery = z.infer<typeof listWorkersQuerySchema>;
export type UpdatePerformanceInput = z.infer<typeof updatePerformanceSchema>;
export type CreateComplianceInput = z.infer<typeof createComplianceSchema>;
export type UpdateComplianceInput = z.infer<typeof updateComplianceSchema>;
export type UpsertWorkerSkillsInput = z.infer<typeof upsertWorkerSkillsSchema>;
export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
