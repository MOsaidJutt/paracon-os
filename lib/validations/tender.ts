import { z } from "zod";

const isoDate = z.coerce.date();

export const expectedLabourSchema = z.record(z.string(), z.number().int().min(0));

export const createTenderSchema = z.object({
  projectName: z.string().min(1, "Project name is required").max(200),
  address: z.string().max(300).optional().nullable(),
  status: z.string().min(1, "Status is required"),
  received: isoDate.optional().nullable(),
  due: isoDate.optional().nullable(),
  submitted: isoDate.optional().nullable(),
  value: z.number().min(0),
  clientId: z.string().min(1, "Client is required"),
  contactId: z.string().optional().nullable(),
  winProbabilityText: z.string().min(1, "Win probability is required"),
  bidDecision: z.string().min(1, "Bid decision is required"),
  intent: z.string().min(1, "Intent is required"),
  reason: z.string().max(500).optional().nullable(),
  outcome: z.string().optional().nullable(),
  winningBid: z.number().min(0).optional().nullable(),
  winningCo: z.string().max(160).optional().nullable(),
  priceDeltaPct: z.number().optional().nullable(),
  marginPct: z.number().optional().nullable(),
  expectedStart: isoDate.optional().nullable(),
  expectedEnd: isoDate.optional().nullable(),
  expectedLabour: expectedLabourSchema.optional().nullable(),
});

export const updateTenderSchema = z.object({
  projectName: z.string().min(1).max(200).optional(),
  address: z.string().max(300).optional().nullable(),
  status: z.string().min(1).optional(),
  received: isoDate.optional().nullable(),
  due: isoDate.optional().nullable(),
  submitted: isoDate.optional().nullable(),
  value: z.number().min(0).optional(),
  clientId: z.string().min(1).optional(),
  contactId: z.string().optional().nullable(),
  winProbabilityText: z.string().min(1).optional(),
  bidDecision: z.string().min(1).optional(),
  intent: z.string().min(1).optional(),
  reason: z.string().max(500).optional().nullable(),
  outcome: z.string().optional().nullable(),
  winningBid: z.number().min(0).optional().nullable(),
  winningCo: z.string().max(160).optional().nullable(),
  priceDeltaPct: z.number().optional().nullable(),
  marginPct: z.number().optional().nullable(),
  expectedStart: isoDate.optional().nullable(),
  expectedEnd: isoDate.optional().nullable(),
  expectedLabour: expectedLabourSchema.optional().nullable(),
});

export const listTendersQuerySchema = z.object({
  status: z.array(z.string()).optional(),
  clientId: z.string().optional(),
  search: z.string().optional(),
  year: z.coerce.number().int().optional(),
  quarter: z.string().optional(),
  sortBy: z
    .enum(["projectName", "value", "due", "received", "status", "winProbabilityNumeric", "createdAt"])
    .default("due"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export const pipelineDemandQuerySchema = z.object({
  start: isoDate,
  end: isoDate,
});

export type CreateTenderInput = z.infer<typeof createTenderSchema>;
export type UpdateTenderInput = z.infer<typeof updateTenderSchema>;
export type ListTendersQuery = z.infer<typeof listTendersQuerySchema>;
export type PipelineDemandQuery = z.infer<typeof pipelineDemandQuerySchema>;
