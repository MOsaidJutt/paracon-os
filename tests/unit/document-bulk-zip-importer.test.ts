import { describe, expect, it } from "vitest";
import { guessCategory, guessMimeFromName } from "@/lib/import/importers/document-bulk-zip";

describe("guessCategory", () => {
  it("maps variation/claim/invoice paths to Submission, Contract & Claims", () => {
    expect(guessCategory("Forever/1_Submission_Contract_Claims/Variations/VQ-01.xlsx")).toBe(
      "Submission, Contract & Claims"
    );
    expect(guessCategory("Forever/1_Submission_Contract_Claims/Forever Invoice Proforma.xlsx")).toBe(
      "Submission, Contract & Claims"
    );
  });

  it("maps SWMS / site file paths to Site File", () => {
    expect(guessCategory("Forever/5_Site File/SWMS 001.pdf")).toBe("Site File");
  });

  it("maps handover/compliance/defects/greenstar paths to Handover Manual", () => {
    expect(guessCategory("Forever/4_Handover Manual/Compliance Certifcates/cert.pdf")).toBe("Handover Manual");
    expect(guessCategory("Forever/4_Handover Manual/Greenstar/scorecard.pdf")).toBe("Handover Manual");
  });

  it("maps quote/purchase-order paths to Quotes & Purchase Orders", () => {
    expect(guessCategory("Forever/2_Quotes_Purchase Orders/supplier-quote.pdf")).toBe("Quotes & Purchase Orders");
  });

  it("maps addenda/site-photo/architectural paths to Documentation", () => {
    expect(guessCategory("Uni Lodge/1. Documentation/1B. Site Photos/photo1.jpg")).toBe("Documentation");
  });

  it("maps measure/takeoff paths to Measure, and tender-letter paths to Submission", () => {
    expect(guessCategory("Uni Lodge/2. Measure/takeoff.xlsx")).toBe("Measure");
    expect(guessCategory("Uni Lodge/3. Submission/Tender Letter.pdf")).toBe("Submission");
  });

  it("falls back to General for an unrecognised path — never silently dropped", () => {
    expect(guessCategory("Misc/random-export/STa10684")).toBe("General");
  });

  it("still keys off a recognisable parent folder even when the file name itself is opaque", () => {
    // The unidentified "STa10684" file from intake notes §13 sits inside "4_Handover Manual" —
    // the path-level keyword match still buckets it sensibly rather than dumping it in General.
    expect(guessCategory("Forever/4_Handover Manual/STa10684")).toBe("Handover Manual");
  });
});

describe("guessMimeFromName", () => {
  it("resolves common extensions to their mime type", () => {
    expect(guessMimeFromName("doc.pdf")).toBe("application/pdf");
    expect(guessMimeFromName("photo.HEIC")).toBe("image/heic");
    expect(guessMimeFromName("sheet.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("falls back to application/octet-stream for an unknown extension", () => {
    expect(guessMimeFromName("mystery.STa10684")).toBe("application/octet-stream");
  });
});
