import type { VariationLineItem, VariationTotals } from "./variation-calc";
import type { ProgressClaimLineResult, ProgressClaimTotals } from "./progress-claim-calc";
import type { TenderPriceTotals } from "./tender-letter-calc";
import type { PdfColorTokens, ScopeLibraryItem, SwmsHazardLibraryItem } from "./templates-config";

/**
 * A project's PM/site manager, auto-filled from Project.pmUserId/foremanUserId
 * (the "enter once" source per CLAUDE.md rule 12) into every project-scoped
 * generated document — null when the project hasn't had one assigned yet,
 * in which case the generation form still accepts a manual override.
 */
export type ProjectResponsiblePersons = {
  pmName: string | null;
  siteManagerName: string | null;
};

/** The correct legal entity (CLAUDE.md rule 14) — read from Organisation, never hard-coded in a generator. */
export type OrgLetterhead = {
  legalName: string;
  abn: string;
  registeredAddress: string;
  logoUrl: string | null;
};

/**
 * Each *Snapshot type is exactly what gets frozen into
 * GeneratedDocument.dataSnapshotJson — the PDF/XLSX generators take one of
 * these in and never reach back into the DB, so a previously-issued document
 * is reproducible byte-for-byte from its snapshot alone.
 */
export type VariationSnapshot = {
  number: string;
  version: number;
  date: string;
  attention: string;
  company: string;
  cc: string;
  from: string;
  projectName: string;
  projectAddress: string;
  introLine: string;
  lineItems: VariationLineItem[];
  totals: VariationTotals;
  validityDays: number;
  signOffName: string;
  signOffRole: string;
  signOffPhone: string;
  org: OrgLetterhead;
  colors: PdfColorTokens;
} & Partial<ProjectResponsiblePersons>;

export type ProgressClaimSnapshot = {
  number: string;
  version: number;
  date: string;
  projectName: string;
  projectAddress: string;
  contractWorkLines: ProgressClaimLineResult[];
  variationLines: ProgressClaimLineResult[];
  totals: ProgressClaimTotals;
  org: OrgLetterhead;
  colors: PdfColorTokens;
} & Partial<ProjectResponsiblePersons>;

export type SwmsHazardLine = Pick<SwmsHazardLibraryItem, "activity" | "hazard" | "riskRating" | "controlMeasures">;

export type SwmsSnapshot = {
  number: string;
  version: number;
  date: string;
  projectName: string;
  projectAddress: string;
  client: string;
  activityDescription: string;
  hazardLines: SwmsHazardLine[];
  ppeItems: string[];
  signOffName: string;
  signOffRole: string;
  org: OrgLetterhead;
  colors: PdfColorTokens;
} & ProjectResponsiblePersons;

export type TenderLetterScopeLine = Pick<ScopeLibraryItem, "code" | "label" | "section">;

export type TenderLetterSnapshot = {
  number: string;
  version: number;
  date: string;
  company: string;
  companyAddress: string;
  contactName: string;
  contactEmail: string;
  projectName: string;
  projectAddress: string;
  documentationReceivedDate: string | null;
  specifications: string;
  addendums: string;
  marginPct: number;
  tenderPrice: TenderPriceTotals;
  scopeLines: TenderLetterScopeLine[];
  qualifications: string[];
  signOffName: string;
  org: OrgLetterhead;
  colors: PdfColorTokens;
};
