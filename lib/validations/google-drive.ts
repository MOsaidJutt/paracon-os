import { z } from "zod";

export const driveTargetSchema = z
  .object({
    projectId: z.string().min(1).optional().nullable(),
    tenderId: z.string().min(1).optional().nullable(),
  })
  .refine((data) => !!data.projectId || !!data.tenderId, {
    message: "A Drive upload must be attached to a project or tender",
  });

export const requestDriveUploadTokenSchema = driveTargetSchema.and(
  z.object({
    fileName: z.string().min(1).max(255),
    mimeType: z.string().min(1),
  })
);

export const registerDriveFileSchema = driveTargetSchema.and(
  z.object({
    driveFileId: z.string().min(1),
    name: z.string().min(1).max(255),
    mimeType: z.string().min(1),
    size: z.number().int().nonnegative().nullable().optional(),
    webViewLink: z.string().url(),
    thumbnailLink: z.string().url().optional().nullable(),
    kind: z.string().min(1),
    source: z.enum(["upload", "picker"]),
  })
);

export type RequestDriveUploadTokenInput = z.infer<typeof requestDriveUploadTokenSchema>;
export type RegisterDriveFileInput = z.infer<typeof registerDriveFileSchema>;
