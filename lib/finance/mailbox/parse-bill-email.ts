import { simpleParser } from "mailparser";
import type { FetchedMessage, ParsedBillEmail } from "./types";

export async function parseBillEmail(message: FetchedMessage): Promise<ParsedBillEmail> {
  const parsed = await simpleParser(message.source);

  return {
    messageId: parsed.messageId ?? message.messageId,
    subject: parsed.subject ?? "",
    fromAddress: parsed.from?.value[0]?.address ?? null,
    textBody: parsed.text ?? "",
    attachments: parsed.attachments.map((a) => ({
      filename: a.filename ?? "attachment",
      mime: a.contentType,
      content: a.content,
    })),
  };
}

const BILL_ATTACHMENT_MIME_PRIORITY = ["application/pdf", "image/jpeg", "image/png"];

/** Picks the most likely "the actual bill" attachment — PDFs first, falling back to the first attachment of any kind. */
export function pickBillAttachment(attachments: ParsedBillEmail["attachments"]): ParsedBillEmail["attachments"][number] | null {
  if (attachments.length === 0) return null;
  for (const mime of BILL_ATTACHMENT_MIME_PRIORITY) {
    const match = attachments.find((a) => a.mime === mime);
    if (match) return match;
  }
  return attachments[0];
}
