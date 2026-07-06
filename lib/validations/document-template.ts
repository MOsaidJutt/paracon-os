import { z } from "zod";

export const pdfColorTokensSchema = z.object({
  ink: z.string().min(1),
  paper: z.string().min(1),
  muted: z.string().min(1),
  accent: z.string().min(1),
  accentSoft: z.string().min(1),
});

export const scopeLibraryItemSchema = z.object({
  id: z.string().min(1),
  code: z.string().max(20).nullable(),
  label: z.string().min(1).max(500),
  section: z.enum(["Partitions & Doors", "Ceiling"]),
  defaultChecked: z.boolean(),
});

export const tenderLetterTemplateConfigSchema = z.object({
  pdfColors: pdfColorTokensSchema,
  scopeLibrary: z.array(scopeLibraryItemSchema),
  qualificationsLibrary: z.array(z.string().min(1).max(500)),
});

export const variationTemplateConfigSchema = z.object({
  pdfColors: pdfColorTokensSchema,
});

export const progressClaimTemplateConfigSchema = z.object({
  pdfColors: pdfColorTokensSchema,
});

export const swmsHazardLibraryItemSchema = z.object({
  id: z.string().min(1),
  activity: z.string().min(1).max(200),
  hazard: z.string().min(1).max(300),
  riskRating: z.enum(["Low", "Medium", "High"]),
  controlMeasures: z.string().min(1).max(1000),
  defaultChecked: z.boolean(),
});

export const swmsTemplateConfigSchema = z.object({
  pdfColors: pdfColorTokensSchema,
  hazardLibrary: z.array(swmsHazardLibraryItemSchema),
  ppeLibrary: z.array(z.string().min(1).max(100)),
});

export const documentTemplateConfigSchemaByType = {
  TENDER_LETTER: tenderLetterTemplateConfigSchema,
  VARIATION: variationTemplateConfigSchema,
  PROGRESS_CLAIM: progressClaimTemplateConfigSchema,
  SWMS: swmsTemplateConfigSchema,
} as const;

export type DocumentTemplateTypeParam = keyof typeof documentTemplateConfigSchemaByType;

export function isDocumentTemplateType(value: string): value is DocumentTemplateTypeParam {
  return value in documentTemplateConfigSchemaByType;
}
