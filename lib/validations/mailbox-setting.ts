import { z } from "zod";

export const upsertMailboxSettingSchema = z.object({
  host: z.string().min(1).max(200),
  port: z.number().int().min(1).max(65535).default(993),
  username: z.string().min(1).max(200),
  // Omitted entirely on an update that isn't rotating the password — never required to re-send the existing secret.
  password: z.string().min(1).max(500).optional(),
  useTls: z.boolean().default(true),
  folder: z.string().min(1).max(100).default("INBOX"),
  enabled: z.boolean().default(false),
});

export type UpsertMailboxSettingInput = z.infer<typeof upsertMailboxSettingSchema>;
