import type { TenantContext } from "@/lib/tenant";
import { assertInList, getConfig } from "@/lib/config";
import { auditLog } from "@/lib/audit";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { putObject } from "@/lib/storage";
import { formatDate } from "@/lib/tenders/format";
import type {
  GenerateProgressClaimInput,
  GenerateSwmsInput,
  GenerateTenderLetterInput,
  GenerateVariationInput,
} from "@/lib/validations/generated-document";
import { buildDocumentKey } from "./storage-keys";
import {
  formatDocumentNumber,
  nextCounterValue,
  progressClaimCounterScope,
  swmsCounterScope,
  tenderLetterCounterScope,
  variationCounterScope,
} from "./numbering";
import { calcVariationTotals } from "./variation-calc";
import { calcProgressClaimLine, calcProgressClaimTotals, type ProgressClaimLineResult } from "./progress-claim-calc";
import { calcTenderPrice, type MarginFormula, type RoundingBasis } from "./tender-letter-calc";
import { buildSwmsHazardLines } from "./swms-calc";
import { loadDocumentTemplateConfig } from "./templates-config";
import { renderVariationPdf } from "./pdf/variation-pdf";
import { renderProgressClaimPdf } from "./pdf/progress-claim-pdf";
import { renderTenderLetterPdf } from "./pdf/tender-letter-pdf";
import { renderSwmsPdf } from "./pdf/swms-pdf";
import { buildVariationWorkbook } from "./xlsx/variation-xlsx";
import { buildProgressClaimWorkbook } from "./xlsx/progress-claim-xlsx";
import { buildTenderLetterWorkbook } from "./xlsx/tender-letter-xlsx";
import type {
  OrgLetterhead,
  ProgressClaimSnapshot,
  ProjectResponsiblePersons,
  SwmsSnapshot,
  TenderLetterScopeLine,
  TenderLetterSnapshot,
  VariationSnapshot,
} from "./types";

// Config-driven, not hard-coded — these must stay in sync with whatever
// category names an org's admin has set on /admin/settings (the same
// document.projectCategoryList / document.tenderCategoryList an admin can
// rename), otherwise a renamed category would silently misfile every
// freshly-generated document into "no category".
async function projectDocumentCategory(organisationId: string): Promise<string> {
  return getConfig<string>("document.generatedDocumentProjectCategory", organisationId);
}

async function tenderDocumentCategory(organisationId: string): Promise<string> {
  return getConfig<string>("document.generatedDocumentTenderCategory", organisationId);
}

async function loadOrgLetterhead(db: TenantContext, organisationId: string): Promise<OrgLetterhead> {
  const org = await db.organisation.findUniqueOrThrow({ where: { id: organisationId } });
  if (!org.legalName || !org.abn || !org.registeredAddress) {
    throw new BadRequestError(
      "This organisation's legal entity (name/ABN/address) isn't set yet — set it on the Branding admin screen before generating documents."
    );
  }
  return { legalName: org.legalName, abn: org.abn, registeredAddress: org.registeredAddress, logoUrl: org.logoUrl };
}

/**
 * PM/site manager, auto-filled from the project record (CLAUDE.md rule 12 —
 * enter once) rather than re-typed on every generated document. Null when the
 * project hasn't had one assigned yet; the generation form still lets the
 * user override/fill it in manually in that case.
 */
async function loadProjectResponsiblePersons(db: TenantContext, projectId: string): Promise<ProjectResponsiblePersons> {
  const project = await db.project.findFirst({
    where: { id: projectId },
    select: { pmUser: { select: { name: true } }, foremanUser: { select: { name: true } } },
  });
  return { pmName: project?.pmUser?.name ?? null, siteManagerName: project?.foremanUser?.name ?? null };
}

async function getNextDocumentNumber(
  organisationId: string,
  scope: string,
  prefixConfigKey: string,
  paddingConfigKey: string
): Promise<string> {
  const [prefix, padding, sequence] = await Promise.all([
    getConfig<string>(prefixConfigKey, organisationId),
    getConfig<number>(paddingConfigKey, organisationId),
    nextCounterValue(organisationId, scope),
  ]);
  return formatDocumentNumber(prefix, padding, sequence);
}

type StoredFileIds = { pdfFileId: string; xlsxFileId: string };

/** PDFs/Excels generated server-side never go through the presigned-upload flow (lib/documents/service.ts) — the server already has the bytes, so it pushes them to storage directly and registers the StoredFile rows itself. */
async function storeGeneratedFiles(
  db: TenantContext,
  organisationId: string,
  userId: string,
  target: { projectId?: string; tenderId?: string },
  category: string,
  baseName: string,
  pdfBuffer: Buffer,
  xlsxBuffer: Buffer
): Promise<StoredFileIds> {
  const pdfKey = buildDocumentKey(organisationId, target, `${baseName}.pdf`);
  const xlsxKey = buildDocumentKey(organisationId, target, `${baseName}.xlsx`);

  await Promise.all([
    putObject(pdfKey, pdfBuffer, "application/pdf"),
    putObject(xlsxKey, xlsxBuffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  ]);

  const [pdfFile, xlsxFile] = await Promise.all([
    db.storedFile.create({
      data: {
        organisationId,
        key: pdfKey,
        name: `${baseName}.pdf`,
        mime: "application/pdf",
        size: pdfBuffer.length,
        category,
        projectId: target.projectId ?? null,
        tenderId: target.tenderId ?? null,
        uploadedByUserId: userId,
      },
    }),
    db.storedFile.create({
      data: {
        organisationId,
        key: xlsxKey,
        name: `${baseName}.xlsx`,
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: xlsxBuffer.length,
        category,
        projectId: target.projectId ?? null,
        tenderId: target.tenderId ?? null,
        uploadedByUserId: userId,
      },
    }),
  ]);

  return { pdfFileId: pdfFile.id, xlsxFileId: xlsxFile.id };
}

/** Same as storeGeneratedFiles but for a PDF-only document (e.g. SWMS — a safety document, not a costing one, so no Excel counterpart). */
async function storeGeneratedPdf(
  db: TenantContext,
  organisationId: string,
  userId: string,
  target: { projectId?: string; tenderId?: string },
  category: string,
  baseName: string,
  pdfBuffer: Buffer
): Promise<{ pdfFileId: string }> {
  const pdfKey = buildDocumentKey(organisationId, target, `${baseName}.pdf`);
  await putObject(pdfKey, pdfBuffer, "application/pdf");
  const pdfFile = await db.storedFile.create({
    data: {
      organisationId,
      key: pdfKey,
      name: `${baseName}.pdf`,
      mime: "application/pdf",
      size: pdfBuffer.length,
      category,
      projectId: target.projectId ?? null,
      tenderId: target.tenderId ?? null,
      uploadedByUserId: userId,
    },
  });
  return { pdfFileId: pdfFile.id };
}

// ─── Variation ────────────────────────────────────────────────────────────────

async function composeVariationSnapshot(
  db: TenantContext,
  organisationId: string,
  input: GenerateVariationInput,
  projectName: string,
  projectAddress: string,
  number: string,
  version: number,
  responsiblePersons: ProjectResponsiblePersons
): Promise<VariationSnapshot> {
  const [gstRatePct, validityDays, org, templateConfig] = await Promise.all([
    getConfig<number>("document.gstRatePct", organisationId),
    getConfig<number>("document.variation.validityDays", organisationId),
    loadOrgLetterhead(db, organisationId),
    loadDocumentTemplateConfig(db, "VARIATION"),
  ]);

  return {
    number,
    version,
    date: formatDate(new Date()),
    attention: input.attention,
    company: input.company,
    cc: input.cc,
    from: input.from,
    projectName,
    projectAddress,
    introLine: input.introLine,
    lineItems: input.lineItems,
    totals: calcVariationTotals(input.lineItems, gstRatePct),
    validityDays,
    signOffName: input.signOffName,
    signOffRole: input.signOffRole,
    signOffPhone: input.signOffPhone,
    org,
    colors: templateConfig.pdfColors,
    ...responsiblePersons,
  };
}

async function renderAndStoreVariation(
  db: TenantContext,
  organisationId: string,
  userId: string,
  projectId: string,
  snapshot: VariationSnapshot
): Promise<StoredFileIds> {
  const [pdfBuffer, xlsxBuffer, category] = [
    await renderVariationPdf(snapshot),
    buildVariationWorkbook(snapshot),
    await projectDocumentCategory(organisationId),
  ];
  return storeGeneratedFiles(
    db,
    organisationId,
    userId,
    { projectId },
    category,
    `${snapshot.number} v${snapshot.version} - Variation Quotation`,
    pdfBuffer,
    xlsxBuffer
  );
}

export async function generateVariation(
  db: TenantContext,
  organisationId: string,
  userId: string,
  input: GenerateVariationInput
) {
  const project = await db.project.findFirst({ where: { id: input.projectId } });
  if (!project) throw new NotFoundError("Project not found");

  const [number, responsiblePersons] = await Promise.all([
    getNextDocumentNumber(
      organisationId,
      variationCounterScope(project.id),
      "document.variation.numberPrefix",
      "document.variation.numberPadding"
    ),
    loadProjectResponsiblePersons(db, project.id),
  ]);
  const snapshot = await composeVariationSnapshot(
    db,
    organisationId,
    input,
    project.name,
    project.address ?? "",
    number,
    1,
    responsiblePersons
  );
  const { pdfFileId, xlsxFileId } = await renderAndStoreVariation(db, organisationId, userId, project.id, snapshot);

  const doc = await db.generatedDocument.create({
    data: {
      organisationId,
      type: "VARIATION",
      projectId: project.id,
      number,
      version: 1,
      dataSnapshotJson: snapshot,
      pdfFileId,
      xlsxFileId,
      createdByUserId: userId,
    },
  });

  await auditLog({
    organisationId,
    userId,
    action: "document.generate",
    entityType: "GeneratedDocument",
    entityId: doc.id,
    after: { type: "VARIATION", number, projectId: project.id },
  });

  return doc;
}

export async function regenerateVariation(
  db: TenantContext,
  organisationId: string,
  userId: string,
  generatedDocumentId: string,
  input: Omit<GenerateVariationInput, "projectId">
) {
  const existing = await db.generatedDocument.findFirst({ where: { id: generatedDocumentId, type: "VARIATION" } });
  if (!existing || !existing.projectId) throw new NotFoundError("Variation not found");
  const project = await db.project.findFirst({ where: { id: existing.projectId } });
  if (!project) throw new NotFoundError("Project not found");

  const nextVersion = existing.version + 1;
  const responsiblePersons = await loadProjectResponsiblePersons(db, project.id);
  const snapshot = await composeVariationSnapshot(
    db,
    organisationId,
    { ...input, projectId: project.id },
    project.name,
    project.address ?? "",
    existing.number,
    nextVersion,
    responsiblePersons
  );
  const { pdfFileId, xlsxFileId } = await renderAndStoreVariation(db, organisationId, userId, project.id, snapshot);

  await db.generatedDocumentVersion.create({
    data: {
      generatedDocumentId: existing.id,
      version: existing.version,
      dataSnapshotJson: existing.dataSnapshotJson as object,
      pdfFileId: existing.pdfFileId,
      xlsxFileId: existing.xlsxFileId,
    },
  });

  const doc = await db.generatedDocument.update({
    where: { id: existing.id },
    data: { version: nextVersion, dataSnapshotJson: snapshot, pdfFileId, xlsxFileId },
  });

  await auditLog({
    organisationId,
    userId,
    action: "document.regenerate",
    entityType: "GeneratedDocument",
    entityId: doc.id,
    before: { version: existing.version },
    after: { version: nextVersion },
  });

  return doc;
}

// ─── Progress Claim ───────────────────────────────────────────────────────────

async function getPriorProgressClaim(db: TenantContext, projectId: string, excludeId?: string): Promise<ProgressClaimSnapshot | null> {
  const prior = await db.generatedDocument.findFirst({
    where: { projectId, type: "PROGRESS_CLAIM", ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return prior ? (prior.dataSnapshotJson as ProgressClaimSnapshot) : null;
}

function previouslyClaimedFor(
  prior: ProgressClaimSnapshot | null,
  section: "contractWorkLines" | "variationLines",
  name: string
): number {
  if (!prior) return 0;
  const match = prior[section].find((l) => l.name === name);
  return match ? match.valueToBeInvoiced : 0;
}

async function composeProgressClaimSnapshot(
  db: TenantContext,
  organisationId: string,
  input: GenerateProgressClaimInput,
  project: { id: string; name: string; address: string | null; tradePackages: unknown },
  number: string,
  version: number,
  responsiblePersons: ProjectResponsiblePersons,
  excludeDocumentId?: string
): Promise<ProgressClaimSnapshot> {
  const tradePackages = (project.tradePackages as { name: string; contractValue: number }[] | null) ?? [];
  const [gstRatePct, org, templateConfig, prior] = await Promise.all([
    getConfig<number>("document.gstRatePct", organisationId),
    loadOrgLetterhead(db, organisationId),
    loadDocumentTemplateConfig(db, "PROGRESS_CLAIM"),
    getPriorProgressClaim(db, project.id, excludeDocumentId),
  ]);

  const contractWorkLines: ProgressClaimLineResult[] = input.contractWorkLines.map((line) => {
    const tradePackage = tradePackages.find((t) => t.name === line.name);
    if (!tradePackage) throw new BadRequestError(`"${line.name}" is not one of this project's trade packages`);
    return calcProgressClaimLine({
      name: line.name,
      percentCompleted: line.percentCompleted,
      contractValue: tradePackage.contractValue,
      previouslyClaimed: previouslyClaimedFor(prior, "contractWorkLines", line.name),
    });
  });

  const variationDocs =
    input.variationLines.length === 0
      ? []
      : await db.generatedDocument.findMany({
          where: { id: { in: input.variationLines.map((v) => v.generatedDocumentId) }, type: "VARIATION", projectId: project.id },
        });

  const variationLines: ProgressClaimLineResult[] = input.variationLines.map((v) => {
    const doc = variationDocs.find((d) => d.id === v.generatedDocumentId);
    if (!doc) throw new NotFoundError(`Variation not found: ${v.generatedDocumentId}`);
    const variationSnapshot = doc.dataSnapshotJson as VariationSnapshot;
    return calcProgressClaimLine({
      name: doc.number,
      percentCompleted: v.percentCompleted,
      contractValue: variationSnapshot.totals.totalExGst,
      previouslyClaimed: previouslyClaimedFor(prior, "variationLines", doc.number),
    });
  });

  return {
    number,
    version,
    date: formatDate(new Date()),
    projectName: project.name,
    projectAddress: project.address ?? "",
    contractWorkLines,
    variationLines,
    totals: calcProgressClaimTotals(contractWorkLines, variationLines, gstRatePct),
    org,
    colors: templateConfig.pdfColors,
    ...responsiblePersons,
  };
}

async function renderAndStoreProgressClaim(
  db: TenantContext,
  organisationId: string,
  userId: string,
  projectId: string,
  snapshot: ProgressClaimSnapshot
): Promise<StoredFileIds> {
  const pdfBuffer = await renderProgressClaimPdf(snapshot);
  const xlsxBuffer = buildProgressClaimWorkbook(snapshot);
  const category = await projectDocumentCategory(organisationId);
  return storeGeneratedFiles(
    db,
    organisationId,
    userId,
    { projectId },
    category,
    `${snapshot.number} v${snapshot.version} - Progress Claim`,
    pdfBuffer,
    xlsxBuffer
  );
}

export async function generateProgressClaim(
  db: TenantContext,
  organisationId: string,
  userId: string,
  input: GenerateProgressClaimInput
) {
  const project = await db.project.findFirst({ where: { id: input.projectId } });
  if (!project) throw new NotFoundError("Project not found");

  const [number, responsiblePersons] = await Promise.all([
    getNextDocumentNumber(
      organisationId,
      progressClaimCounterScope(project.id),
      "document.progressClaim.numberPrefix",
      "document.progressClaim.numberPadding"
    ),
    loadProjectResponsiblePersons(db, project.id),
  ]);
  const snapshot = await composeProgressClaimSnapshot(db, organisationId, input, project, number, 1, responsiblePersons);
  const { pdfFileId, xlsxFileId } = await renderAndStoreProgressClaim(db, organisationId, userId, project.id, snapshot);

  const doc = await db.generatedDocument.create({
    data: {
      organisationId,
      type: "PROGRESS_CLAIM",
      projectId: project.id,
      number,
      version: 1,
      dataSnapshotJson: snapshot,
      pdfFileId,
      xlsxFileId,
      createdByUserId: userId,
    },
  });

  await auditLog({
    organisationId,
    userId,
    action: "document.generate",
    entityType: "GeneratedDocument",
    entityId: doc.id,
    after: { type: "PROGRESS_CLAIM", number, projectId: project.id },
  });

  return doc;
}

export async function regenerateProgressClaim(
  db: TenantContext,
  organisationId: string,
  userId: string,
  generatedDocumentId: string,
  input: Omit<GenerateProgressClaimInput, "projectId">
) {
  const existing = await db.generatedDocument.findFirst({ where: { id: generatedDocumentId, type: "PROGRESS_CLAIM" } });
  if (!existing || !existing.projectId) throw new NotFoundError("Progress claim not found");
  const project = await db.project.findFirst({ where: { id: existing.projectId } });
  if (!project) throw new NotFoundError("Project not found");

  const nextVersion = existing.version + 1;
  const responsiblePersons = await loadProjectResponsiblePersons(db, project.id);
  // Excludes this claim itself from "prior claim" so regenerating Claim #2 still carries forward from Claim #1, not from its own previous attempt.
  const snapshot = await composeProgressClaimSnapshot(
    db,
    organisationId,
    { ...input, projectId: project.id },
    project,
    existing.number,
    nextVersion,
    responsiblePersons,
    existing.id
  );
  const { pdfFileId, xlsxFileId } = await renderAndStoreProgressClaim(db, organisationId, userId, project.id, snapshot);

  await db.generatedDocumentVersion.create({
    data: {
      generatedDocumentId: existing.id,
      version: existing.version,
      dataSnapshotJson: existing.dataSnapshotJson as object,
      pdfFileId: existing.pdfFileId,
      xlsxFileId: existing.xlsxFileId,
    },
  });

  const doc = await db.generatedDocument.update({
    where: { id: existing.id },
    data: { version: nextVersion, dataSnapshotJson: snapshot, pdfFileId, xlsxFileId },
  });

  await auditLog({
    organisationId,
    userId,
    action: "document.regenerate",
    entityType: "GeneratedDocument",
    entityId: doc.id,
    before: { version: existing.version },
    after: { version: nextVersion },
  });

  return doc;
}

// ─── Tender Letter ────────────────────────────────────────────────────────────

async function composeTenderLetterSnapshot(
  db: TenantContext,
  organisationId: string,
  input: GenerateTenderLetterInput,
  tender: { id: string; projectName: string; address: string | null; client: { name: string; address: string | null } },
  number: string,
  version: number
): Promise<TenderLetterSnapshot> {
  const [gstRatePct, marginDefaultPct, marginFormula, roundingBasis, roundUpNearest, org, templateConfig] = await Promise.all([
    getConfig<number>("document.gstRatePct", organisationId),
    getConfig<number>("document.tenderLetter.marginDefaultPct", organisationId),
    getConfig<string>("document.tenderLetter.marginFormula", organisationId),
    getConfig<string>("document.tenderLetter.roundingBasis", organisationId),
    getConfig<number>("document.tenderLetter.roundUpToNearest", organisationId),
    loadOrgLetterhead(db, organisationId),
    loadDocumentTemplateConfig(db, "TENDER_LETTER"),
  ]);

  // These two Config values are free-text (admin-editable per CLAUDE.md's
  // "config not code" rule) but only two literal values are ever valid —
  // fail loudly on a typo'd override instead of silently misapplying the
  // wrong pricing formula.
  assertInList(marginFormula, ["MARGIN_ON_SELL", "MARKUP_ON_COST"], "document.tenderLetter.marginFormula");
  assertInList(roundingBasis, ["EX_GST", "INC_GST"], "document.tenderLetter.roundingBasis");

  const marginPct = input.marginPct ?? marginDefaultPct;
  const tenderPrice = calcTenderPrice(
    input.tradeCostLines,
    marginPct,
    marginFormula as MarginFormula,
    roundingBasis as RoundingBasis,
    roundUpNearest,
    gstRatePct
  );

  const checkedLibraryLines: TenderLetterScopeLine[] = templateConfig.scopeLibrary
    .filter((item) => input.scopeLibraryItemIds.includes(item.id))
    .map((item) => ({ code: item.code, label: item.label, section: item.section }));
  const scopeLines: TenderLetterScopeLine[] = [
    ...checkedLibraryLines,
    ...input.customScopeLines.map((line) => ({ code: line.code ?? null, label: line.label, section: line.section })),
  ];

  return {
    number,
    version,
    date: formatDate(new Date()),
    company: tender.client.name,
    companyAddress: tender.client.address ?? "",
    contactName: input.contactName,
    contactEmail: input.contactEmail ?? "",
    projectName: tender.projectName,
    projectAddress: tender.address ?? "",
    documentationReceivedDate: input.documentationReceivedDate ? formatDate(input.documentationReceivedDate) : null,
    specifications: input.specifications,
    addendums: input.addendums,
    marginPct,
    tenderPrice,
    scopeLines,
    qualifications: input.qualifications.length > 0 ? input.qualifications : templateConfig.qualificationsLibrary,
    signOffName: input.signOffName,
    org,
    colors: templateConfig.pdfColors,
  };
}

async function renderAndStoreTenderLetter(
  db: TenantContext,
  organisationId: string,
  userId: string,
  tenderId: string,
  snapshot: TenderLetterSnapshot
): Promise<StoredFileIds> {
  const pdfBuffer = await renderTenderLetterPdf(snapshot);
  const xlsxBuffer = buildTenderLetterWorkbook(snapshot);
  const category = await tenderDocumentCategory(organisationId);
  return storeGeneratedFiles(
    db,
    organisationId,
    userId,
    { tenderId },
    category,
    `${snapshot.number} v${snapshot.version} - Tender Letter`,
    pdfBuffer,
    xlsxBuffer
  );
}

export async function generateTenderLetter(
  db: TenantContext,
  organisationId: string,
  userId: string,
  input: GenerateTenderLetterInput
) {
  const tender = await db.tender.findFirst({ where: { id: input.tenderId }, include: { client: true } });
  if (!tender) throw new NotFoundError("Tender not found");

  const number = await getNextDocumentNumber(
    organisationId,
    tenderLetterCounterScope(tender.id),
    "document.tenderLetter.numberPrefix",
    "document.tenderLetter.numberPadding"
  );
  const snapshot = await composeTenderLetterSnapshot(db, organisationId, input, tender, number, 1);
  const { pdfFileId, xlsxFileId } = await renderAndStoreTenderLetter(db, organisationId, userId, tender.id, snapshot);

  const doc = await db.generatedDocument.create({
    data: {
      organisationId,
      type: "TENDER_LETTER",
      tenderId: tender.id,
      number,
      version: 1,
      dataSnapshotJson: snapshot,
      pdfFileId,
      xlsxFileId,
      createdByUserId: userId,
    },
  });

  await auditLog({
    organisationId,
    userId,
    action: "document.generate",
    entityType: "GeneratedDocument",
    entityId: doc.id,
    after: { type: "TENDER_LETTER", number, tenderId: tender.id },
  });

  return doc;
}

export async function regenerateTenderLetter(
  db: TenantContext,
  organisationId: string,
  userId: string,
  generatedDocumentId: string,
  input: Omit<GenerateTenderLetterInput, "tenderId">
) {
  const existing = await db.generatedDocument.findFirst({ where: { id: generatedDocumentId, type: "TENDER_LETTER" } });
  if (!existing || !existing.tenderId) throw new NotFoundError("Tender letter not found");
  const tender = await db.tender.findFirst({ where: { id: existing.tenderId }, include: { client: true } });
  if (!tender) throw new NotFoundError("Tender not found");

  const nextVersion = existing.version + 1;
  const snapshot = await composeTenderLetterSnapshot(
    db,
    organisationId,
    { ...input, tenderId: tender.id },
    tender,
    existing.number,
    nextVersion
  );
  const { pdfFileId, xlsxFileId } = await renderAndStoreTenderLetter(db, organisationId, userId, tender.id, snapshot);

  await db.generatedDocumentVersion.create({
    data: {
      generatedDocumentId: existing.id,
      version: existing.version,
      dataSnapshotJson: existing.dataSnapshotJson as object,
      pdfFileId: existing.pdfFileId,
      xlsxFileId: existing.xlsxFileId,
    },
  });

  const doc = await db.generatedDocument.update({
    where: { id: existing.id },
    data: { version: nextVersion, dataSnapshotJson: snapshot, pdfFileId, xlsxFileId },
  });

  await auditLog({
    organisationId,
    userId,
    action: "document.regenerate",
    entityType: "GeneratedDocument",
    entityId: doc.id,
    before: { version: existing.version },
    after: { version: nextVersion },
  });

  return doc;
}

// ─── SWMS ─────────────────────────────────────────────────────────────────────

async function composeSwmsSnapshot(
  db: TenantContext,
  organisationId: string,
  input: GenerateSwmsInput,
  project: { id: string; name: string; address: string | null; client: { name: string } },
  number: string,
  version: number,
  responsiblePersons: ProjectResponsiblePersons
): Promise<SwmsSnapshot> {
  const [org, templateConfig] = await Promise.all([
    loadOrgLetterhead(db, organisationId),
    loadDocumentTemplateConfig(db, "SWMS"),
  ]);

  const hazardLines = buildSwmsHazardLines(templateConfig.hazardLibrary, input.hazardLibraryItemIds, input.customHazardLines);
  const ppeItems = input.ppeItems.length > 0 ? input.ppeItems : templateConfig.ppeLibrary;

  return {
    number,
    version,
    date: formatDate(new Date()),
    projectName: project.name,
    projectAddress: project.address ?? "",
    client: project.client.name,
    activityDescription: input.activityDescription,
    hazardLines,
    ppeItems,
    signOffName: input.signOffName,
    signOffRole: input.signOffRole,
    org,
    colors: templateConfig.pdfColors,
    ...responsiblePersons,
  };
}

async function renderAndStoreSwms(
  db: TenantContext,
  organisationId: string,
  userId: string,
  projectId: string,
  snapshot: SwmsSnapshot
): Promise<{ pdfFileId: string }> {
  const pdfBuffer = await renderSwmsPdf(snapshot);
  const category = await projectDocumentCategory(organisationId);
  return storeGeneratedPdf(db, organisationId, userId, { projectId }, category, `${snapshot.number} v${snapshot.version} - SWMS`, pdfBuffer);
}

export async function generateSwms(db: TenantContext, organisationId: string, userId: string, input: GenerateSwmsInput) {
  const project = await db.project.findFirst({ where: { id: input.projectId }, include: { client: { select: { name: true } } } });
  if (!project) throw new NotFoundError("Project not found");

  const [number, responsiblePersons] = await Promise.all([
    getNextDocumentNumber(organisationId, swmsCounterScope(project.id), "document.swms.numberPrefix", "document.swms.numberPadding"),
    loadProjectResponsiblePersons(db, project.id),
  ]);
  const snapshot = await composeSwmsSnapshot(db, organisationId, input, project, number, 1, responsiblePersons);
  const { pdfFileId } = await renderAndStoreSwms(db, organisationId, userId, project.id, snapshot);

  const doc = await db.generatedDocument.create({
    data: {
      organisationId,
      type: "SWMS",
      projectId: project.id,
      number,
      version: 1,
      dataSnapshotJson: snapshot,
      pdfFileId,
      createdByUserId: userId,
    },
  });

  await auditLog({
    organisationId,
    userId,
    action: "document.generate",
    entityType: "GeneratedDocument",
    entityId: doc.id,
    after: { type: "SWMS", number, projectId: project.id },
  });

  return doc;
}

export async function regenerateSwms(
  db: TenantContext,
  organisationId: string,
  userId: string,
  generatedDocumentId: string,
  input: Omit<GenerateSwmsInput, "projectId">
) {
  const existing = await db.generatedDocument.findFirst({ where: { id: generatedDocumentId, type: "SWMS" } });
  if (!existing || !existing.projectId) throw new NotFoundError("SWMS not found");
  const project = await db.project.findFirst({
    where: { id: existing.projectId },
    include: { client: { select: { name: true } } },
  });
  if (!project) throw new NotFoundError("Project not found");

  const nextVersion = existing.version + 1;
  const responsiblePersons = await loadProjectResponsiblePersons(db, project.id);
  const snapshot = await composeSwmsSnapshot(
    db,
    organisationId,
    { ...input, projectId: project.id },
    project,
    existing.number,
    nextVersion,
    responsiblePersons
  );
  const { pdfFileId } = await renderAndStoreSwms(db, organisationId, userId, project.id, snapshot);

  await db.generatedDocumentVersion.create({
    data: {
      generatedDocumentId: existing.id,
      version: existing.version,
      dataSnapshotJson: existing.dataSnapshotJson as object,
      pdfFileId: existing.pdfFileId,
      xlsxFileId: existing.xlsxFileId,
    },
  });

  const doc = await db.generatedDocument.update({
    where: { id: existing.id },
    data: { version: nextVersion, dataSnapshotJson: snapshot, pdfFileId, xlsxFileId: null },
  });

  await auditLog({
    organisationId,
    userId,
    action: "document.regenerate",
    entityType: "GeneratedDocument",
    entityId: doc.id,
    before: { version: existing.version },
    after: { version: nextVersion },
  });

  return doc;
}

// ─── Listing ───────────────────────────────────────────────────────────────────

export async function listGeneratedDocuments(db: TenantContext, target: { projectId?: string; tenderId?: string }) {
  return db.generatedDocument.findMany({
    where: target.projectId ? { projectId: target.projectId } : { tenderId: target.tenderId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
}

/** Every superseded version of one generated document — each row's pdfFileId/xlsxFileId are the archived StoredFile ids from the version that was current at the time, so they're always downloadable through the normal stored-file URL route even after a regenerate. */
export async function listGeneratedDocumentVersions(db: TenantContext, generatedDocumentId: string) {
  const existing = await db.generatedDocument.findFirst({ where: { id: generatedDocumentId } });
  if (!existing) throw new NotFoundError("Generated document not found");

  return db.generatedDocumentVersion.findMany({
    where: { generatedDocumentId },
    orderBy: { version: "desc" },
  });
}
