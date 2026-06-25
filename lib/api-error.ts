import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorisedError } from "./errors";

/** Maps a thrown error to the correct HTTP response per the API security rules. */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorisedError) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof BadRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid input", issues: error.flatten() },
      { status: 400 }
    );
  }
  if (error instanceof SyntaxError) {
    // Malformed JSON body from req.json() — bad input, not a server fault.
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
