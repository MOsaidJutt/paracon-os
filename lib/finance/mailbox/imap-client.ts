import { ImapFlow } from "imapflow";
import type { MailboxCredentials, FetchedMessage } from "./types";

/**
 * Fetches every message with UID greater than `sinceUid` from the configured
 * folder of the org's own accounts inbox. A standard IMAP connection to a
 * mailbox the org itself owns — not a third-party SaaS call — so it stays
 * inside the self-contained boundary (CLAUDE.md rule 11), same as Resend for
 * outbound mail.
 */
export async function fetchNewMessages(credentials: MailboxCredentials, sinceUid: number): Promise<FetchedMessage[]> {
  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port,
    secure: credentials.useTls,
    auth: { user: credentials.username, pass: credentials.password },
    logger: false,
  });

  await client.connect();
  const messages: FetchedMessage[] = [];
  try {
    const lock = await client.getMailboxLock(credentials.folder);
    try {
      const status = await client.status(credentials.folder, { uidNext: true });
      const uidNext = status.uidNext ?? sinceUid + 1;
      if (uidNext <= sinceUid + 1) return [];

      for await (const message of client.fetch(`${sinceUid + 1}:${uidNext - 1}`, { uid: true, source: true, envelope: true })) {
        if (message.uid <= sinceUid || !message.source) continue;
        messages.push({ uid: message.uid, messageId: message.envelope?.messageId ?? null, source: message.source });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  return messages;
}

/** Verifies the configured credentials can actually log in — backs the admin "Test connection" action. */
export async function testMailboxConnection(credentials: MailboxCredentials): Promise<void> {
  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port,
    secure: credentials.useTls,
    auth: { user: credentials.username, pass: credentials.password },
    logger: false,
  });
  await client.connect();
  await client.logout().catch(() => undefined);
}
