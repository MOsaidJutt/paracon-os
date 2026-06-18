import { describe, expect, it } from "vitest";
import { scopeArgs, UNSCOPED_MODELS } from "@/lib/tenant";

const ORG_A = "org_a";
const ORG_B = "org_b";

describe("scopeArgs", () => {
  it("injects organisationId into where for findMany on a scoped model", () => {
    const result = scopeArgs("user", "findMany", { where: { isActive: true } }, ORG_A);
    expect(result.where).toEqual({ isActive: true, organisationId: ORG_A });
  });

  it("overrides a cross-tenant organisationId rather than trusting caller input", () => {
    // Simulates a malicious/buggy caller trying to read another org's rows.
    const result = scopeArgs(
      "user",
      "findMany",
      { where: { organisationId: ORG_B } },
      ORG_A
    );
    expect((result.where as { organisationId: string }).organisationId).toBe(ORG_A);
  });

  it("injects organisationId into data on create", () => {
    const result = scopeArgs("user", "create", { data: { name: "Test" } }, ORG_A);
    expect(result.data).toEqual({ name: "Test", organisationId: ORG_A });
  });

  it("injects organisationId into every row on createMany", () => {
    const result = scopeArgs(
      "user",
      "createMany",
      { data: [{ name: "A" }, { name: "B" }] },
      ORG_A
    );
    expect(result.data).toEqual([
      { name: "A", organisationId: ORG_A },
      { name: "B", organisationId: ORG_A },
    ]);
  });

  it("scopes update and delete where clauses", () => {
    const update = scopeArgs("user", "update", { where: { id: "u1" }, data: {} }, ORG_A);
    expect((update.where as { organisationId: string }).organisationId).toBe(ORG_A);

    const del = scopeArgs("user", "delete", { where: { id: "u1" } }, ORG_A);
    expect((del.where as { organisationId: string }).organisationId).toBe(ORG_A);
  });

  it("leaves unscoped models untouched", () => {
    for (const model of UNSCOPED_MODELS) {
      const result = scopeArgs(model, "findMany", { where: { slug: "x" } }, ORG_A);
      expect(result.where).toEqual({ slug: "x" });
    }
  });

  it("leaves findUnique untouched (no arbitrary where support)", () => {
    const result = scopeArgs("user", "findUnique", { where: { id: "u1" } }, ORG_A);
    expect(result.where).toEqual({ id: "u1" });
  });
});
