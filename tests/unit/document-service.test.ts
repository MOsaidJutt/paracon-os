import { describe, expect, it } from "vitest";
import { validateCategory } from "@/lib/documents/service";
import { BadRequestError } from "@/lib/errors";

const CONFIG = {
  projectCategoryList: ["Submission, Contract & Claims", "Quotes & Purchase Orders", "Documentation", "Handover Manual", "Site File", "General"],
  tenderCategoryList: ["Documentation", "Measure", "Submission", "Supplier Quotes", "General"],
  linkedKindList: ["Drawing Set", "CAD File", "Architectural Specification", "Photo Archive", "Other"],
};

describe("validateCategory", () => {
  it("accepts a category from the project list for a project-targeted document", () => {
    expect(() => validateCategory({ projectId: "p1" }, "Site File", CONFIG)).not.toThrow();
  });

  it("rejects a tender-only category for a project-targeted document", () => {
    expect(() => validateCategory({ projectId: "p1" }, "Measure", CONFIG)).toThrow(BadRequestError);
  });

  it("accepts a category from the tender list for a tender-targeted document", () => {
    expect(() => validateCategory({ tenderId: "t1" }, "Supplier Quotes", CONFIG)).not.toThrow();
  });

  it("rejects a project-only category for a tender-targeted document", () => {
    expect(() => validateCategory({ tenderId: "t1" }, "Site File", CONFIG)).toThrow(BadRequestError);
  });

  it("falls back to the combined list (plus General) for a worker-targeted document", () => {
    expect(() => validateCategory({}, "General", CONFIG)).not.toThrow();
    expect(() => validateCategory({}, "Measure", CONFIG)).not.toThrow();
  });

  it("rejects a category that isn't in any configured list", () => {
    expect(() => validateCategory({ projectId: "p1" }, "Not A Real Category", CONFIG)).toThrow(BadRequestError);
  });
});
