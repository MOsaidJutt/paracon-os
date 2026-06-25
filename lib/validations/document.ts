import { z } from "zod";

// File types observed across the real folder audit (intake notes §9.3 file
// profile: PDF/JPG/XLSX/DOCX/EML/DOC/XLS/PNG/MSG/HEIC) plus webp for modern
// phone camera uploads.
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "text/plain",
  "message/rfc822",
] as const;

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

const targetRefinement = (data: { projectId?: string | null; tenderId?: string | null; workerId?: string | null }) =>
  !!data.projectId || !!data.tenderId || !!data.workerId;

export const requestUploadUrlSchema = z
  .object({
    fileName: z.string().min(1).max(255),
    mime: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
    size: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
    category: z.string().min(1),
    projectId: z.string().min(1).optional().nullable(),
    tenderId: z.string().min(1).optional().nullable(),
    workerId: z.string().min(1).optional().nullable(),
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  })
  .refine(targetRefinement, { message: "A document must be attached to a project, tender or worker" });

export const registerStoredFileSchema = z
  .object({
    key: z.string().min(1),
    fileName: z.string().min(1).max(255),
    mime: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
    size: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
    category: z.string().min(1),
    projectId: z.string().min(1).optional().nullable(),
    tenderId: z.string().min(1).optional().nullable(),
    workerId: z.string().min(1).optional().nullable(),
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  })
  .refine(targetRefinement, { message: "A document must be attached to a project, tender or worker" });

export const registerNewVersionSchema = z.object({
  key: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mime: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
  size: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
});

export const updateStoredFileSchema = z.object({
  category: z.string().min(1).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
});

export const createLinkedDocumentSchema = z
  .object({
    name: z.string().min(1).max(255),
    driveUrl: z.string().url().refine((url) => url.includes("drive.google.com") || url.includes("docs.google.com"), {
      message: "Must be a Google Drive link",
    }),
    kind: z.string().min(1),
    projectId: z.string().min(1).optional().nullable(),
    tenderId: z.string().min(1).optional().nullable(),
  })
  .refine((data) => !!data.projectId || !!data.tenderId, {
    message: "A linked document must be attached to a project or tender",
  });

export const updateLinkedDocumentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  driveUrl: z
    .string()
    .url()
    .refine((url) => url.includes("drive.google.com") || url.includes("docs.google.com"), {
      message: "Must be a Google Drive link",
    })
    .optional(),
  kind: z.string().min(1).optional(),
});

export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>;
export type RegisterStoredFileInput = z.infer<typeof registerStoredFileSchema>;
export type RegisterNewVersionInput = z.infer<typeof registerNewVersionSchema>;
export type UpdateStoredFileInput = z.infer<typeof updateStoredFileSchema>;
export type CreateLinkedDocumentInput = z.infer<typeof createLinkedDocumentSchema>;
export type UpdateLinkedDocumentInput = z.infer<typeof updateLinkedDocumentSchema>;
