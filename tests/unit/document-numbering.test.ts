import { describe, expect, it } from "vitest";
import {
  formatDocumentNumber,
  progressClaimCounterScope,
  tenderLetterCounterScope,
  variationCounterScope,
} from "@/lib/documents/numbering";

describe("formatDocumentNumber", () => {
  it("zero-pads to the configured width", () => {
    expect(formatDocumentNumber("VQ-", 2, 3)).toBe("VQ-03");
    expect(formatDocumentNumber("VQ-", 2, 12)).toBe("VQ-12");
  });

  it("does not truncate a sequence wider than the padding", () => {
    expect(formatDocumentNumber("VQ-", 2, 103)).toBe("VQ-103");
  });

  it("disables padding when padding is 0", () => {
    expect(formatDocumentNumber("Claim #", 0, 7)).toBe("Claim #7");
  });

  it("supports a blank prefix for a bare number", () => {
    expect(formatDocumentNumber("", 0, 5)).toBe("5");
  });
});

describe("counter scope keys", () => {
  it("are namespaced per document type and per project/tender so numbering resets per scope", () => {
    expect(variationCounterScope("p1")).toBe("VARIATION:p1");
    expect(progressClaimCounterScope("p1")).toBe("PROGRESS_CLAIM:p1");
    expect(tenderLetterCounterScope("t1")).toBe("TENDER_LETTER:t1");
    expect(variationCounterScope("p1")).not.toBe(variationCounterScope("p2"));
  });
});
