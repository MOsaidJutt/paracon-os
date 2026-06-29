import { describe, expect, it } from "vitest";
import { createSupplierSchema, updateSupplierSchema } from "@/lib/validations/supplier";

describe("createSupplierSchema", () => {
  it("requires a kind (Supplier vs Subcontractor category)", () => {
    const result = createSupplierSchema.safeParse({
      trade: "Aluminium",
      company: "Steel & Glass Co",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid supplier with kind set", () => {
    const result = createSupplierSchema.safeParse({
      trade: "Aluminium",
      company: "Steel & Glass Co",
      kind: "Subcontractor",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateSupplierSchema", () => {
  it("allows a partial update that omits kind", () => {
    const result = updateSupplierSchema.safeParse({ company: "Renamed Co" });
    expect(result.success).toBe(true);
  });

  it("still rejects an empty kind string when one is provided", () => {
    const result = updateSupplierSchema.safeParse({ kind: "" });
    expect(result.success).toBe(false);
  });
});
