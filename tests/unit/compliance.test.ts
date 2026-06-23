import { describe, expect, it } from "vitest";
import { computeComplianceStatus } from "@/lib/labour/compliance";

const THRESHOLD = 30;
const NOW = new Date("2026-06-18T00:00:00.000Z");

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("computeComplianceStatus", () => {
  it("is Valid when there is no expiry date", () => {
    expect(computeComplianceStatus(null, THRESHOLD, NOW)).toBe("Valid");
  });

  it("is Valid when the expiry is well beyond the threshold", () => {
    expect(computeComplianceStatus(daysFromNow(365), THRESHOLD, NOW)).toBe("Valid");
  });

  it("is Expiring when the expiry is within the threshold", () => {
    expect(computeComplianceStatus(daysFromNow(20), THRESHOLD, NOW)).toBe("Expiring");
  });

  it("is Expiring at exactly the threshold boundary", () => {
    expect(computeComplianceStatus(daysFromNow(THRESHOLD), THRESHOLD, NOW)).toBe("Expiring");
  });

  it("is Valid the day just outside the threshold boundary", () => {
    expect(computeComplianceStatus(daysFromNow(THRESHOLD + 1), THRESHOLD, NOW)).toBe("Valid");
  });

  it("is Expiring when the expiry is today", () => {
    expect(computeComplianceStatus(NOW, THRESHOLD, NOW)).toBe("Expiring");
  });

  it("is Expired when the expiry date has passed", () => {
    expect(computeComplianceStatus(daysFromNow(-1), THRESHOLD, NOW)).toBe("Expired");
  });

  it("is Expired well past the expiry date", () => {
    expect(computeComplianceStatus(daysFromNow(-365), THRESHOLD, NOW)).toBe("Expired");
  });
});
