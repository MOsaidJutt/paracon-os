import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { searchAll } from "@/lib/search";

/** Global search — any authenticated user can call it; results are filtered per-type to what they hold view permission for. */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const query = new URL(req.url).searchParams.get("q") ?? "";
    const results = await searchAll(session.user.organisationId, session, query);
    return NextResponse.json({ results });
  } catch (error) {
    return toErrorResponse(error);
  }
}
