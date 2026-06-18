import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { toErrorResponse } from "@/lib/api-error";
import { ForbiddenError, NotFoundError, UnauthorisedError } from "@/lib/errors";

describe("toErrorResponse", () => {
  it("maps UnauthorisedError to 401", async () => {
    const res = toErrorResponse(new UnauthorisedError());
    expect(res.status).toBe(401);
  });

  it("maps ForbiddenError to 403", async () => {
    const res = toErrorResponse(new ForbiddenError("admin.users"));
    expect(res.status).toBe(403);
  });

  it("maps NotFoundError to 404, not 403 — never confirms cross-tenant existence", async () => {
    const res = toErrorResponse(new NotFoundError());
    expect(res.status).toBe(404);
  });

  it("maps ZodError to 400 with issue details", async () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");

    const res = toErrorResponse(result.error as ZodError);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid input");
  });

  it("maps malformed JSON (SyntaxError) to 400, not 500", async () => {
    // Reproduces the real bug: req.json() throws SyntaxError on a bad body.
    let caught: unknown;
    try {
      JSON.parse("not json at all");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SyntaxError);

    const res = toErrorResponse(caught);
    expect(res.status).toBe(400);
  });

  it("falls back to 500 for genuinely unexpected errors", async () => {
    const res = toErrorResponse(new Error("boom"));
    expect(res.status).toBe(500);
  });
});
