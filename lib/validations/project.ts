import { z } from "zod";

const isoDate = z.coerce.date();

export const labourRequiredSchema = z.record(z.string(), z.number().int().min(0));

// The project's trade-package list + contracted value per trade — the single
// source for the Tender Letter's TENDER PRICE rows and the Progress Claim's
// CONTRACT WORK rows (lib/documents/generation-service.ts), so a PM enters
// this once instead of retyping trade values on every generated document.
export const tradePackageSchema = z.object({
  name: z.string().min(1).max(100),
  contractValue: z.number().min(0),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  code: z.string().min(1, "Code is required").max(40),
  address: z.string().max(300).optional().nullable(),
  status: z.string().min(1, "Status is required"),
  value: z.number().min(0),
  startDate: isoDate,
  endDate: isoDate,
  clientId: z.string().min(1, "Client is required"),
  pmUserId: z.string().optional().nullable(),
  foremanUserId: z.string().optional().nullable(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(40).optional(),
  address: z.string().max(300).optional().nullable(),
  status: z.string().min(1).optional(),
  value: z.number().min(0).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  clientId: z.string().min(1).optional(),
  pmUserId: z.string().optional().nullable(),
  foremanUserId: z.string().optional().nullable(),
  tradePackages: z.array(tradePackageSchema).optional(),
  costBudget: z.number().min(0).optional().nullable(),
});

export const listProjectsQuerySchema = z.object({
  status: z.array(z.string()).optional(),
  clientId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["name", "value", "startDate", "endDate", "status", "createdAt"]).default("startDate"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export const createActivitySchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    trade: z.string().min(1, "Trade is required"),
    startDate: isoDate,
    endDate: isoDate,
    isCritical: z.boolean().default(false),
    milestoneType: z.string().optional().nullable(),
    status: z.string().min(1, "Status is required"),
    labourRequired: labourRequiredSchema.default({}),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export const updateActivitySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  trade: z.string().min(1).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  isCritical: z.boolean().optional(),
  milestoneType: z.string().optional().nullable(),
  status: z.string().min(1).optional(),
  labourRequired: labourRequiredSchema.optional(),
});

export type TradePackageInput = z.infer<typeof tradePackageSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
