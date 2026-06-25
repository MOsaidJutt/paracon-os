import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import { decrypt } from "@/lib/crypto";
import { putObject } from "@/lib/storage";
import { getConfig } from "@/lib/config";
import { loadFinanceConfig } from "@/lib/finance/config";
import { round2, calcGst } from "@/lib/documents/money";
import { fetchNewMessages } from "./imap-client";
import { parseBillEmail, pickBillAttachment } from "./parse-bill-email";
import { extractPdfText } from "./extract-pdf-text";
import { parseStructuredBillFields, resolveJobNumberMatch } from "@/lib/finance/job-number-match";

function toValidDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Polls one org's accounts inbox for new messages since the last seen UID,
 * ingests each as a SupplierBill (Received, source=Email), and auto-allocates
 * to a project when the job number resolves with high confidence. Anything
 * else lands Unallocated for the accounts person to assign in one click.
 */
export async function pollMailboxForOrg(organisationId: string): Promise<{ ingested: number; unallocated: number }> {
  const setting = await prisma.mailboxSetting.findUnique({ where: { organisationId } });
  if (!setting || !setting.enabled) return { ingested: 0, unallocated: 0 };

  const db = getTenantContext(organisationId);
  const credentials = {
    host: setting.host,
    port: setting.port,
    username: setting.username,
    password: decrypt(setting.passwordEncrypted),
    useTls: setting.useTls,
    folder: setting.folder,
  };

  const messages = await fetchNewMessages(credentials, setting.lastSeenUid);
  if (messages.length === 0) {
    await prisma.mailboxSetting.update({ where: { organisationId }, data: { lastPolledAt: new Date() } });
    return { ingested: 0, unallocated: 0 };
  }

  const [projects, suppliers, gstRatePct, financeConfig] = await Promise.all([
    db.project.findMany({ select: { id: true, code: true } }),
    db.supplier.findMany({ select: { id: true, email: true } }),
    getConfig<number>("document.gstRatePct", organisationId),
    loadFinanceConfig(organisationId),
  ]);
  const projectCodes = projects.map((p) => p.code);

  let ingested = 0;
  let unallocated = 0;
  let maxUid = setting.lastSeenUid;

  for (const message of messages) {
    maxUid = Math.max(maxUid, message.uid);
    const parsed = await parseBillEmail(message);
    // Can't dedupe a re-poll without a Message-ID — skip rather than risk double-ingestion.
    if (!parsed.messageId) continue;

    const existing = await db.supplierBill.findFirst({ where: { emailMessageId: parsed.messageId } });
    if (existing) continue;

    const billAttachment = pickBillAttachment(parsed.attachments);
    if (!billAttachment) continue; // no attachment -> nothing to review, not a bill

    const pdfText = billAttachment.mime === "application/pdf" ? await extractPdfText(billAttachment.content) : "";
    const rawTexts = [parsed.subject, parsed.textBody, billAttachment.filename, pdfText];
    const structured = rawTexts.map(parseStructuredBillFields).find((f) => f?.jobNumber) ?? null;

    const match = resolveJobNumberMatch({ structured, rawTexts, existingProjectCodes: projectCodes });
    const matchedProject = match.matchedProjectCode ? projects.find((p) => p.code === match.matchedProjectCode) ?? null : null;
    const matchedSupplier = parsed.fromAddress
      ? suppliers.find((s) => s.email?.toLowerCase() === parsed.fromAddress?.toLowerCase()) ?? null
      : null;

    let poId: string | null = null;
    if (matchedProject && matchedSupplier) {
      const openPos = await db.purchaseOrder.findMany({
        where: {
          projectId: matchedProject.id,
          supplierId: matchedSupplier.id,
          status: { in: financeConfig.poOpenStatusesForBillMatch },
        },
      });
      if (openPos.length === 1) poId = openPos[0].id;
    }

    const safeMessageId = parsed.messageId.replace(/[^a-zA-Z0-9.@_-]/g, "_");
    const key = `bills/${organisationId}/${safeMessageId}/${billAttachment.filename}`;
    await putObject(key, billAttachment.content, billAttachment.mime);
    const storedFile = await db.storedFile.create({
      data: {
        organisationId,
        key,
        name: billAttachment.filename,
        mime: billAttachment.mime,
        size: billAttachment.content.length,
        category: "Supplier Bill",
        projectId: matchedProject?.id ?? null,
      },
    });

    const totalIncGst = structured?.totalAmount ?? 0;
    const amountExGst = totalIncGst > 0 ? round2(totalIncGst / (1 + gstRatePct / 100)) : 0;
    const gstAmount = totalIncGst > 0 ? calcGst(amountExGst, gstRatePct) : 0;

    await db.supplierBill.create({
      data: {
        organisationId,
        projectId: matchedProject?.id ?? null,
        supplierId: matchedSupplier?.id ?? null,
        supplierNameRaw: parsed.fromAddress,
        poId,
        billFileId: storedFile.id,
        invoiceNumber: structured?.invoiceNumber ?? null,
        invoiceDate: toValidDate(structured?.invoiceDate),
        amountExGst,
        gstAmount,
        amountIncGst: totalIncGst,
        jobNumberRaw: match.jobNumberRaw,
        allocationStatus: matchedProject ? "Allocated" : "Unallocated",
        status: "Received",
        source: "Email",
        emailMessageId: parsed.messageId,
      },
    });

    ingested += 1;
    if (!matchedProject) unallocated += 1;
  }

  await prisma.mailboxSetting.update({ where: { organisationId }, data: { lastSeenUid: maxUid, lastPolledAt: new Date() } });

  return { ingested, unallocated };
}

export async function pollAllMailboxes(): Promise<Record<string, { ingested: number; unallocated: number }>> {
  const settings = await prisma.mailboxSetting.findMany({ where: { enabled: true }, select: { organisationId: true } });
  const results: Record<string, { ingested: number; unallocated: number }> = {};
  for (const setting of settings) {
    try {
      results[setting.organisationId] = await pollMailboxForOrg(setting.organisationId);
    } catch (error) {
      console.error(`[mailbox] poll failed for org ${setting.organisationId}:`, error instanceof Error ? error.message : error);
      results[setting.organisationId] = { ingested: 0, unallocated: 0 };
    }
  }
  return results;
}
