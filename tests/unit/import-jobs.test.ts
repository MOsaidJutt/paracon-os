import { describe, expect, it } from "vitest";
import { hashBuffer } from "@/lib/import/jobs";

describe("hashBuffer", () => {
  it("is deterministic for identical content", () => {
    const a = hashBuffer(Buffer.from("tender tracker contents"));
    const b = hashBuffer(Buffer.from("tender tracker contents"));
    expect(a).toBe(b);
  });

  it("differs for different content — the basis of the idempotency check", () => {
    const a = hashBuffer(Buffer.from("version 1"));
    const b = hashBuffer(Buffer.from("version 2"));
    expect(a).not.toBe(b);
  });

  it("returns a sha256 hex digest", () => {
    const hash = hashBuffer(Buffer.from("x"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
