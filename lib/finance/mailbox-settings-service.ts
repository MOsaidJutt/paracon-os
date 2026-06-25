import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { NotFoundError } from "@/lib/errors";
import { testMailboxConnection } from "./mailbox/imap-client";
import type { UpsertMailboxSettingInput } from "@/lib/validations/mailbox-setting";

export type MailboxSettingView = {
  id: string;
  host: string;
  port: number;
  username: string;
  useTls: boolean;
  folder: string;
  enabled: boolean;
  lastPolledAt: Date | null;
  hasPassword: boolean;
};

function toView(row: { id: string; host: string; port: number; username: string; useTls: boolean; folder: string; enabled: boolean; lastPolledAt: Date | null; passwordEncrypted: string }): MailboxSettingView {
  return {
    id: row.id,
    host: row.host,
    port: row.port,
    username: row.username,
    useTls: row.useTls,
    folder: row.folder,
    enabled: row.enabled,
    lastPolledAt: row.lastPolledAt,
    hasPassword: row.passwordEncrypted.length > 0,
  };
}

export async function getMailboxSetting(organisationId: string): Promise<MailboxSettingView | null> {
  const row = await prisma.mailboxSetting.findUnique({ where: { organisationId } });
  return row ? toView(row) : null;
}

export async function upsertMailboxSetting(
  organisationId: string,
  userId: string,
  input: UpsertMailboxSettingInput
): Promise<MailboxSettingView> {
  const existing = await prisma.mailboxSetting.findUnique({ where: { organisationId } });
  if (!input.password && !existing) {
    throw new Error("A password is required when setting up the mailbox for the first time");
  }

  const row = await prisma.mailboxSetting.upsert({
    where: { organisationId },
    update: {
      host: input.host,
      port: input.port,
      username: input.username,
      ...(input.password ? { passwordEncrypted: encrypt(input.password) } : {}),
      useTls: input.useTls,
      folder: input.folder,
      enabled: input.enabled,
      updatedBy: userId,
    },
    create: {
      organisationId,
      host: input.host,
      port: input.port,
      username: input.username,
      passwordEncrypted: encrypt(input.password ?? ""),
      useTls: input.useTls,
      folder: input.folder,
      enabled: input.enabled,
      updatedBy: userId,
    },
  });

  return toView(row);
}

/** Backs the admin "Test connection" action — never persists, just confirms the credentials actually log in. */
export async function testMailboxSetting(organisationId: string, override?: { password?: string }): Promise<void> {
  const existing = await prisma.mailboxSetting.findUnique({ where: { organisationId } });
  if (!existing) throw new NotFoundError("Mailbox is not configured yet");

  const { decrypt } = await import("@/lib/crypto");
  const password = override?.password ?? decrypt(existing.passwordEncrypted);

  await testMailboxConnection({
    host: existing.host,
    port: existing.port,
    username: existing.username,
    password,
    useTls: existing.useTls,
    folder: existing.folder,
  });
}
