import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { setPreference } from "@/lib/preferences";
import { getViewMode, viewModeSchema, VIEW_MODE_PREFERENCE_KEY } from "@/lib/view-mode";

/**
 * The Simplified/Full toggle. No permission slug: a user always owns their own
 * view preference, and the choice grants nothing — every underlying route
 * still enforces its own RBAC.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const viewMode = await getViewMode(session.user.organisationId, session.user.id);
    return NextResponse.json({ viewMode });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireSession();
    const { viewMode } = await bodySchema(req);

    await setPreference(session.user.organisationId, session.user.id, VIEW_MODE_PREFERENCE_KEY, viewMode);

    return NextResponse.json({ viewMode });
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function bodySchema(req: NextRequest) {
  const json = await req.json();
  return { viewMode: viewModeSchema.parse((json as { viewMode?: unknown })?.viewMode) };
}
