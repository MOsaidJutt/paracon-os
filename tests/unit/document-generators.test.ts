import { describe, expect, it } from "vitest";
import { renderVariationPdf } from "@/lib/documents/pdf/variation-pdf";
import { renderProgressClaimPdf } from "@/lib/documents/pdf/progress-claim-pdf";
import { renderTenderLetterPdf } from "@/lib/documents/pdf/tender-letter-pdf";
import { renderSwmsPdf } from "@/lib/documents/pdf/swms-pdf";
import { buildVariationWorkbook } from "@/lib/documents/xlsx/variation-xlsx";
import { buildProgressClaimWorkbook } from "@/lib/documents/xlsx/progress-claim-xlsx";
import { buildTenderLetterWorkbook } from "@/lib/documents/xlsx/tender-letter-xlsx";
import { buildSwmsHazardLines } from "@/lib/documents/swms-calc";
import { DEFAULT_PDF_COLORS, DEFAULT_SWMS_HAZARD_LIBRARY, DEFAULT_SWMS_PPE_LIBRARY } from "@/lib/documents/templates-config";
import type { VariationSnapshot, ProgressClaimSnapshot, TenderLetterSnapshot, SwmsSnapshot } from "@/lib/documents/types";

const ORG = {
  legalName: "Paracon Group Pty Ltd",
  abn: "80 317 795 082",
  registeredAddress: "Unit 10/65 Mark Street, North Melbourne VIC 3051",
  logoUrl: null,
};

const VARIATION_SNAPSHOT: VariationSnapshot = {
  number: "VQ-01",
  version: 1,
  date: "23 Jun 2026",
  attention: "Simon Kenny",
  company: "Schiavello Vic Pty Ltd",
  cc: "Jarrod Dunstone",
  from: "Peter Kuo",
  projectName: "Transurban Office Fitout",
  projectAddress: "Level 22 & 23, 727 Collins Street, Melbourne, VIC 3000",
  introLine: "Please find below various additional works undertaken outside of our contractual scope.",
  lineItems: [{ item: 1, description: "Extend existing plaster lining on columns (x12)", amount: 1350 }],
  totals: { totalExGst: 1350, gst: 135, totalIncGst: 1485 },
  validityDays: 7,
  signOffName: "Peter Kuo",
  signOffRole: "Project Manager",
  signOffPhone: "0422 522 833",
  org: ORG,
  colors: DEFAULT_PDF_COLORS,
};

const PROGRESS_CLAIM_SNAPSHOT: ProgressClaimSnapshot = {
  number: "Claim #1",
  version: 1,
  date: "23 Jun 2026",
  projectName: "Riverside Quarter Fitout",
  projectAddress: "123 Example St, Melbourne",
  contractWorkLines: [
    { name: "Partitions", percentCompleted: 50, contractValue: 271_916.67, previouslyClaimed: 0, valueToBeInvoiced: 135_958.34, thisClaim: 135_958.34 },
  ],
  variationLines: [],
  totals: {
    contractWork: { contractValue: 271_916.67, valueToBeInvoiced: 135_958.34, previouslyClaimed: 0, thisClaim: 135_958.34 },
    variations: { contractValue: 0, valueToBeInvoiced: 0, previouslyClaimed: 0, thisClaim: 0 },
    subtotalExGst: 135_958.34,
    gst: 13_595.83,
    totalIncGst: 149_554.17,
  },
  org: ORG,
  colors: DEFAULT_PDF_COLORS,
};

const TENDER_LETTER_SNAPSHOT: TenderLetterSnapshot = {
  number: "TL-01",
  version: 1,
  date: "23 Jun 2026",
  company: "MPA",
  companyAddress: "L1, 99 King Street, Melbourne, VIC 3000",
  contactName: "Robert Rasic",
  contactEmail: "robert.rasic@mpa.com.au",
  projectName: "Forever - L36",
  projectAddress: "80 Collins Street, Melbourne",
  documentationReceivedDate: "27-Nov-2025",
  specifications: "",
  addendums: "",
  marginPct: 6,
  tenderPrice: {
    tradeLines: [{ name: "Partitions", costAmount: 480_000, sellAmount: 510_638.3 }],
    subtotalExGst: 740_000,
    gst: 74_000,
    totalIncGst: 814_000,
  },
  scopeLines: [
    { code: "P1-P4", label: "Plasterboard walls", section: "Partitions & Doors" },
    { code: "PB1", label: "Standard plasterboard", section: "Ceiling" },
  ],
  qualifications: ["Our pricing is based on continuous work/ uninterrupted access during normal hours."],
  signOffName: "Adrian Rous",
  org: ORG,
  colors: DEFAULT_PDF_COLORS,
};

const SWMS_SNAPSHOT: SwmsSnapshot = {
  number: "SWMS-01",
  version: 1,
  date: "23 Jun 2026",
  projectName: "Riverside Quarter Fitout",
  projectAddress: "123 Example St, Melbourne",
  client: "Meridian Funds Management",
  pmName: "Priya Manager",
  siteManagerName: "Frank Foreman",
  activityDescription: "General fitout works — partition walls, ceiling grid, doors and joinery to Level 2.",
  hazardLines: buildSwmsHazardLines(DEFAULT_SWMS_HAZARD_LIBRARY, [DEFAULT_SWMS_HAZARD_LIBRARY[0].id], [
    { activity: "Custom activity", hazard: "Custom hazard", riskRating: "Low", controlMeasures: "Custom control measure" },
  ]),
  ppeItems: DEFAULT_SWMS_PPE_LIBRARY,
  signOffName: "Priya Manager",
  signOffRole: "Project Manager",
  org: ORG,
  colors: DEFAULT_PDF_COLORS,
};

describe("buildSwmsHazardLines", () => {
  it("includes only the checked library items, in library order", () => {
    const lines = buildSwmsHazardLines(DEFAULT_SWMS_HAZARD_LIBRARY, [DEFAULT_SWMS_HAZARD_LIBRARY[1].id], []);
    expect(lines).toHaveLength(1);
    expect(lines[0].hazard).toBe(DEFAULT_SWMS_HAZARD_LIBRARY[1].hazard);
  });

  it("appends custom hazard lines after the checked library items", () => {
    const custom = { activity: "Custom", hazard: "Custom hazard", riskRating: "High" as const, controlMeasures: "Control" };
    const lines = buildSwmsHazardLines(DEFAULT_SWMS_HAZARD_LIBRARY, [DEFAULT_SWMS_HAZARD_LIBRARY[0].id], [custom]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual(custom);
  });

  it("returns an empty list when nothing is checked and no custom lines given", () => {
    expect(buildSwmsHazardLines(DEFAULT_SWMS_HAZARD_LIBRARY, [], [])).toEqual([]);
  });
});

describe("PDF generators", () => {
  it("renders a Variation PDF", async () => {
    const buffer = await renderVariationPdf(VARIATION_SNAPSHOT);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("renders a Progress Claim PDF", async () => {
    const buffer = await renderProgressClaimPdf(PROGRESS_CLAIM_SNAPSHOT);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders a Tender Letter PDF", async () => {
    const buffer = await renderTenderLetterPdf(TENDER_LETTER_SNAPSHOT);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders a SWMS PDF", async () => {
    const buffer = await renderSwmsPdf(SWMS_SNAPSHOT);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(500);
  });
});

describe("XLSX generators", () => {
  it("builds a Variation workbook", () => {
    const buffer = buildVariationWorkbook(VARIATION_SNAPSHOT);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 2).toString("hex")).toBe("504b"); // xlsx is a zip ("PK")
  });

  it("builds a Progress Claim workbook", () => {
    const buffer = buildProgressClaimWorkbook(PROGRESS_CLAIM_SNAPSHOT);
    expect(buffer.subarray(0, 2).toString("hex")).toBe("504b");
  });

  it("builds a Tender Letter workbook", () => {
    const buffer = buildTenderLetterWorkbook(TENDER_LETTER_SNAPSHOT);
    expect(buffer.subarray(0, 2).toString("hex")).toBe("504b");
  });
});
