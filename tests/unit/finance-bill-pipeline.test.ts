import { describe, expect, it } from "vitest";
import { canApproveBill, canMarkPaid, canMarkReconciled, canMarkSentToEzzyBills, isUnderReview } from "@/lib/finance/bill-pipeline";

describe("canApproveBill (the approval gate)", () => {
  it("requires all four checklist items confirmed", () => {
    expect(
      canApproveBill({ orderedConfirmed: true, receivedConfirmed: true, quantityConfirmed: true, priceConfirmed: true })
    ).toBe(true);
  });

  it("rejects approval if even one item is unconfirmed", () => {
    expect(
      canApproveBill({ orderedConfirmed: true, receivedConfirmed: true, quantityConfirmed: true, priceConfirmed: false })
    ).toBe(false);
  });

  it("rejects approval with nothing confirmed", () => {
    expect(
      canApproveBill({ orderedConfirmed: false, receivedConfirmed: false, quantityConfirmed: false, priceConfirmed: false })
    ).toBe(false);
  });
});

describe("bill status pipeline order", () => {
  it("only allows marking sent to EzzyBills from Approved", () => {
    expect(canMarkSentToEzzyBills("Approved")).toBe(true);
    expect(canMarkSentToEzzyBills("Under review")).toBe(false);
    expect(canMarkSentToEzzyBills("Received")).toBe(false);
  });

  it("allows marking paid from Approved or Sent to EzzyBills", () => {
    expect(canMarkPaid("Approved")).toBe(true);
    expect(canMarkPaid("Sent to EzzyBills")).toBe(true);
    expect(canMarkPaid("Under review")).toBe(false);
  });

  it("only allows marking reconciled once paid", () => {
    expect(canMarkReconciled("Paid")).toBe(true);
    expect(canMarkReconciled("Approved")).toBe(false);
  });

  it("treats Received, Under review and Queried as still in-review", () => {
    expect(isUnderReview("Received")).toBe(true);
    expect(isUnderReview("Under review")).toBe(true);
    expect(isUnderReview("Queried")).toBe(true);
    expect(isUnderReview("Approved")).toBe(false);
    expect(isUnderReview("Rejected")).toBe(false);
  });
});
