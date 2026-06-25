import type { TenantContext } from "@/lib/tenant";

/**
 * One reusable scope-builder bullet (Tender Letter "SCOPE OF WORKS"). Mirrors
 * the hidden boolean-flag columns found in the real Tender Letter xlsx
 * (Forever's P1-P4/G1-G3/D1-D2/PB1-PB5/CL1-CL2 set) — a checkable library
 * rather than a fixed enum, per intake notes gap #6. An estimator checks the
 * ones that apply to this job and can add free-text custom lines on top, so
 * a fully bespoke scope (like Uni Lodge's) is just as supported.
 */
export type ScopeLibraryItem = {
  id: string;
  code: string | null;
  label: string;
  section: "Partitions & Doors" | "Ceiling";
  defaultChecked: boolean;
};

export type PdfColorTokens = {
  ink: string;
  paper: string;
  muted: string;
  accent: string;
  accentSoft: string;
};

/** Brand defaults from CLAUDE.md — overridable per org/type so a future white-label tenant isn't stuck on Paracon's palette. */
export const DEFAULT_PDF_COLORS: PdfColorTokens = {
  ink: "#222323",
  paper: "#f4f3f0",
  muted: "#6f6f6e",
  accent: "#6b4f43",
  accentSoft: "#ddc8b8",
};

export type TenderLetterTemplateConfig = {
  pdfColors: PdfColorTokens;
  scopeLibrary: ScopeLibraryItem[];
  qualificationsLibrary: string[];
};

export type VariationTemplateConfig = {
  pdfColors: PdfColorTokens;
};

export type ProgressClaimTemplateConfig = {
  pdfColors: PdfColorTokens;
};

export type DocumentTemplateConfigByType = {
  TENDER_LETTER: TenderLetterTemplateConfig;
  VARIATION: VariationTemplateConfig;
  PROGRESS_CLAIM: ProgressClaimTemplateConfig;
};

// Seeded from the real Forever Tender Letter (intake notes §7) — the org's
// starting library. Fully editable from the admin Document Templates screen;
// estimators can also add one-off custom lines per letter that never touch
// this shared library.
export const DEFAULT_TENDER_LETTER_SCOPE_LIBRARY: ScopeLibraryItem[] = [
  { id: "p1-p4", code: "P1-P4", label: "P1, P2, P3, P4 type plasterboard walls (incl insulation and joinery noggins, skirting).", section: "Partitions & Doors", defaultChecked: false },
  { id: "g1-g3", code: "G1-G3", label: "G1, G2, G3 type glass partitions.", section: "Partitions & Doors", defaultChecked: false },
  { id: "d1-d2", code: "D1-D2", label: "D1, D2 type doors, associated frames and hardware (incl. manual door operators, door relief grilles, vision panel).", section: "Partitions & Doors", defaultChecked: false },
  { id: "skirting", code: null, label: "Skirting to base building core walls and columns.", section: "Partitions & Doors", defaultChecked: true },
  { id: "patch-partitions", code: null, label: "20 hours patch and make good (to be used at the discretion of the builder on site).", section: "Partitions & Doors", defaultChecked: true },
  { id: "pb1", code: "PB1", label: "PB1 standard plasterboard.", section: "Ceiling", defaultChecked: false },
  { id: "pb2", code: "PB2", label: "PB2 moisture resistant plasterboard.", section: "Ceiling", defaultChecked: false },
  { id: "pb3", code: "PB3", label: "PB3 fire resistant plasterboard.", section: "Ceiling", defaultChecked: false },
  { id: "pb4", code: "PB4", label: "PB4 sound resistant plasterboard.", section: "Ceiling", defaultChecked: false },
  { id: "pb5", code: "PB5", label: "PB5 perforated plasterboard.", section: "Ceiling", defaultChecked: false },
  { id: "cl1", code: "CL1", label: 'CL1 "Brand" grid and tiles.', section: "Ceiling", defaultChecked: false },
  { id: "cl2", code: "CL2", label: 'CL2 "Brand/Specifications" specialty ceiling.', section: "Ceiling", defaultChecked: false },
  { id: "access-panels", code: null, label: "Access panels.", section: "Ceiling", defaultChecked: false },
  { id: "patch-ceiling", code: null, label: "20 hours patch and make good (to be used at the discretion of the builder on site).", section: "Ceiling", defaultChecked: true },
];

export const DEFAULT_TENDER_LETTER_QUALIFICATIONS_LIBRARY: string[] = [
  "Our pricing is based on continuous work/ uninterrupted access during normal hours.",
  "We have allowed to carry out trade clean relevant to our scope of work and place rubbish in bins provided on the floor by Builder.",
  "Allowance for plaster surface in level 4 finish.",
  "Seismic restraints associated with our new works only in accordance with the Australian Standards (compliance statement will be provided).",
  "We have assumed the architectural details are in line with acoustic recommendations. Our allowance is based on such details in lieu of the acoustic report as we are not qualified in the field of acoustic engineering to make any interpretation.",
  "Lead times for feature products to be confirmed at the time of order. These suppliers require a deposit, which will be passed on to the builder for payment.",
];

export function defaultDocumentTemplateConfig<T extends keyof DocumentTemplateConfigByType>(
  type: T
): DocumentTemplateConfigByType[T] {
  if (type === "TENDER_LETTER") {
    return {
      pdfColors: DEFAULT_PDF_COLORS,
      scopeLibrary: DEFAULT_TENDER_LETTER_SCOPE_LIBRARY,
      qualificationsLibrary: DEFAULT_TENDER_LETTER_QUALIFICATIONS_LIBRARY,
    } satisfies TenderLetterTemplateConfig as DocumentTemplateConfigByType[T];
  }
  return { pdfColors: DEFAULT_PDF_COLORS } as DocumentTemplateConfigByType[T];
}

/** Loads an org's DocumentTemplate config, falling back to the built-in default if none has been saved yet. */
export async function loadDocumentTemplateConfig<T extends keyof DocumentTemplateConfigByType>(
  db: TenantContext,
  type: T
): Promise<DocumentTemplateConfigByType[T]> {
  const row = await db.documentTemplate.findFirst({ where: { type } });
  if (!row || !row.isActive) return defaultDocumentTemplateConfig(type);
  return row.configJson as DocumentTemplateConfigByType[T];
}
