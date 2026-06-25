import { describe, expect, it } from "vitest";
import { extractJobNumberCandidates, parseStructuredBillFields, resolveJobNumberMatch } from "@/lib/finance/job-number-match";

describe("extractJobNumberCandidates", () => {
  it("finds a P##-#### pattern regardless of case", () => {
    expect(extractJobNumberCandidates("Re: invoice for p26-1001 fitout")).toEqual(["P26-1001"]);
  });

  it("dedupes repeated matches", () => {
    expect(extractJobNumberCandidates("P26-1001 ... P26-1001 again")).toEqual(["P26-1001"]);
  });

  it("returns multiple distinct matches", () => {
    expect(extractJobNumberCandidates("P26-1001 and P27-0042")).toEqual(["P26-1001", "P27-0042"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(extractJobNumberCandidates("no job number here")).toEqual([]);
  });
});

describe("parseStructuredBillFields", () => {
  it("parses an EzzyBills-style labelled text block", () => {
    const text = "Supplier: BuildRight Hardware\nInvoice Number: INV-3321\nJob Number: P26-1001\nTotal Amount: $24,200.00";
    const result = parseStructuredBillFields(text);
    expect(result).toEqual({
      supplierName: "BuildRight Hardware",
      invoiceNumber: "INV-3321",
      jobNumber: "P26-1001",
      totalAmount: 24200,
    });
  });

  it("returns null when nothing recognisable is found", () => {
    expect(parseStructuredBillFields("just a plain email body with no structure")).toBeNull();
  });
});

describe("resolveJobNumberMatch", () => {
  const existingProjectCodes = ["P26-1001", "P26-1002"];

  it("prefers a structured EzzyBills jobNumber field when it matches a real project", () => {
    const result = resolveJobNumberMatch({
      structured: { jobNumber: "P26-1001" },
      rawTexts: ["irrelevant body mentioning P26-1002"],
      existingProjectCodes,
    });
    expect(result).toEqual({ jobNumberRaw: "P26-1001", matchedProjectCode: "P26-1001", confidence: "high", source: "ezzybills" });
  });

  it("auto-allocates on a single, unambiguous regex match against a real project", () => {
    const result = resolveJobNumberMatch({
      structured: null,
      rawTexts: ["Invoice for job P26-1001", "thanks"],
      existingProjectCodes,
    });
    expect(result.matchedProjectCode).toBe("P26-1001");
    expect(result.confidence).toBe("high");
    expect(result.source).toBe("regex");
  });

  it("routes to the Unallocated tray when no job number is found anywhere", () => {
    const result = resolveJobNumberMatch({ structured: null, rawTexts: ["no reference here"], existingProjectCodes });
    expect(result.matchedProjectCode).toBeNull();
    expect(result.confidence).toBe("low");
    expect(result.source).toBe("none");
  });

  it("routes to the Unallocated tray when multiple distinct real projects are mentioned", () => {
    const result = resolveJobNumberMatch({
      structured: null,
      rawTexts: ["Could be for P26-1001 or possibly P26-1002"],
      existingProjectCodes,
    });
    expect(result.matchedProjectCode).toBeNull();
    expect(result.confidence).toBe("low");
  });

  it("routes to the Unallocated tray when the only match found isn't a real project", () => {
    const result = resolveJobNumberMatch({ structured: null, rawTexts: ["P99-9999 doesn't exist"], existingProjectCodes });
    expect(result.matchedProjectCode).toBeNull();
    expect(result.jobNumberRaw).toBe("P99-9999");
    expect(result.confidence).toBe("low");
  });
});
