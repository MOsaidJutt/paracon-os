import { describe, expect, it } from "vitest";
import { buildDocumentKey, buildImportStagingKey, buildPreviewKey } from "@/lib/documents/storage-keys";

describe("buildDocumentKey", () => {
  it("scopes the key under projects/{id} for a project target", () => {
    const key = buildDocumentKey("org1", { projectId: "p1" }, "Variation Template.xlsx");
    expect(key).toMatch(/^documents\/org1\/projects\/p1\/.+-Variation Template\.xlsx$/);
  });

  it("scopes the key under tenders/{id} for a tender target", () => {
    const key = buildDocumentKey("org1", { tenderId: "t1" }, "Tender Letter.pdf");
    expect(key).toContain("documents/org1/tenders/t1/");
  });

  it("scopes the key under workers/{id} for a worker target", () => {
    const key = buildDocumentKey("org1", { workerId: "w1" }, "card.jpg");
    expect(key).toContain("documents/org1/workers/w1/");
  });

  it("prefers projectId over tenderId/workerId when more than one is somehow present", () => {
    const key = buildDocumentKey("org1", { projectId: "p1", tenderId: "t1" }, "file.pdf");
    expect(key).toContain("/projects/p1/");
  });

  it("throws if no target is provided", () => {
    expect(() => buildDocumentKey("org1", {}, "file.pdf")).toThrow();
  });

  it("generates a different key for the same file name on repeated calls (no overwrite collisions)", () => {
    const a = buildDocumentKey("org1", { projectId: "p1" }, "same-name.pdf");
    const b = buildDocumentKey("org1", { projectId: "p1" }, "same-name.pdf");
    expect(a).not.toBe(b);
  });

  it("strips characters that aren't safe in an object key", () => {
    const key = buildDocumentKey("org1", { projectId: "p1" }, "VQ-10 (WITHDRAWN)!.xlsx");
    expect(key).not.toMatch(/[!]/);
    expect(key).toContain("VQ-10 (WITHDRAWN).xlsx");
  });
});

describe("buildPreviewKey", () => {
  it("appends a .preview.jpg suffix to the original key", () => {
    expect(buildPreviewKey("documents/org1/projects/p1/abc-photo.heic")).toBe(
      "documents/org1/projects/p1/abc-photo.heic.preview.jpg"
    );
  });
});

describe("buildImportStagingKey", () => {
  it("namespaces the staged file under the import job id", () => {
    const key = buildImportStagingKey("org1", "job1", "Tender Tracker.xlsx");
    expect(key).toBe("import-staging/org1/job1-Tender Tracker.xlsx");
  });
});
