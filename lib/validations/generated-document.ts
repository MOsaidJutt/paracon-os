import { z } from "zod";

export const variationLineItemSchema = z.object({
  item: z.number().int().positive(),
  description: z.string().min(1).max(500),
  amount: z.number(),
});

export const generateVariationSchema = z.object({
  projectId: z.string().min(1),
  attention: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  cc: z.string().max(300).optional().default(""),
  from: z.string().min(1).max(200),
  introLine: z.string().min(1).max(1000),
  lineItems: z.array(variationLineItemSchema).min(1),
  signOffName: z.string().min(1).max(200),
  signOffRole: z.string().min(1).max(200),
  signOffPhone: z.string().max(60).optional().default(""),
});

export const progressClaimTradeLineInputSchema = z.object({
  name: z.string().min(1),
  percentCompleted: z.number().min(0).max(100),
});

export const progressClaimVariationLineInputSchema = z.object({
  generatedDocumentId: z.string().min(1),
  percentCompleted: z.number().min(0).max(100),
});

export const generateProgressClaimSchema = z.object({
  projectId: z.string().min(1),
  contractWorkLines: z.array(progressClaimTradeLineInputSchema).min(1),
  variationLines: z.array(progressClaimVariationLineInputSchema).default([]),
});

export const tenderLetterTradeCostLineSchema = z.object({
  name: z.string().min(1),
  costAmount: z.number().min(0),
});

export const tenderLetterCustomScopeLineSchema = z.object({
  section: z.enum(["Partitions & Doors", "Ceiling"]),
  code: z.string().max(20).optional().nullable(),
  label: z.string().min(1).max(500),
});

export const generateTenderLetterSchema = z.object({
  tenderId: z.string().min(1),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email().optional().or(z.literal("")),
  documentationReceivedDate: z.coerce.date().optional().nullable(),
  specifications: z.string().max(1000).optional().default(""),
  addendums: z.string().max(1000).optional().default(""),
  marginPct: z.number().min(0).max(99).optional(),
  tradeCostLines: z.array(tenderLetterTradeCostLineSchema).min(1),
  scopeLibraryItemIds: z.array(z.string()).default([]),
  customScopeLines: z.array(tenderLetterCustomScopeLineSchema).default([]),
  qualifications: z.array(z.string().min(1).max(500)).default([]),
  signOffName: z.string().min(1).max(200),
});

export const swmsCustomHazardLineSchema = z.object({
  activity: z.string().min(1).max(200),
  hazard: z.string().min(1).max(300),
  riskRating: z.enum(["Low", "Medium", "High"]),
  controlMeasures: z.string().min(1).max(1000),
});

const swmsBaseSchema = z.object({
  projectId: z.string().min(1),
  activityDescription: z.string().min(1).max(1000),
  hazardLibraryItemIds: z.array(z.string()).default([]),
  customHazardLines: z.array(swmsCustomHazardLineSchema).default([]),
  ppeItems: z.array(z.string().min(1).max(100)).default([]),
  signOffName: z.string().min(1).max(200),
  signOffRole: z.string().min(1).max(200),
});

function requiresAtLeastOneHazard(data: { hazardLibraryItemIds: string[]; customHazardLines: unknown[] }) {
  return data.hazardLibraryItemIds.length + data.customHazardLines.length > 0;
}

export const generateSwmsSchema = swmsBaseSchema.refine(requiresAtLeastOneHazard, {
  message: "At least one hazard is required",
  path: ["hazardLibraryItemIds"],
});

export const regenerateVariationSchema = generateVariationSchema.omit({ projectId: true });
export const regenerateProgressClaimSchema = generateProgressClaimSchema.omit({ projectId: true });
export const regenerateTenderLetterSchema = generateTenderLetterSchema.omit({ tenderId: true });
export const regenerateSwmsSchema = swmsBaseSchema.omit({ projectId: true }).refine(requiresAtLeastOneHazard, {
  message: "At least one hazard is required",
  path: ["hazardLibraryItemIds"],
});

export type GenerateVariationInput = z.infer<typeof generateVariationSchema>;
export type GenerateProgressClaimInput = z.infer<typeof generateProgressClaimSchema>;
export type GenerateTenderLetterInput = z.infer<typeof generateTenderLetterSchema>;
export type GenerateSwmsInput = z.infer<typeof generateSwmsSchema>;
