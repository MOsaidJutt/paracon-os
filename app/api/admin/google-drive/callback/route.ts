import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { completeConnect } from "@/lib/google-drive/service";
import { OAUTH_STATE_COOKIE } from "../connect/route";

function redirectWithMessage(req: NextRequest, kind: "connected" | "error", message?: string): NextResponse {
  const url = new URL("/admin/google-drive", req.url);
  url.searchParams.set(kind, message ?? "1");
  const res = NextResponse.redirect(url);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

/** Google redirects here after the admin grants (or denies) consent. Never throws to a JSON error response — always redirects back to the admin Google Drive page with a query param the UI turns into a toast. */
export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requirePermission("admin.settings");
  } catch {
    return redirectWithMessage(req, "error", "You no longer have permission to connect Google Drive");
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("error")) {
    return redirectWithMessage(req, "error", "Google sign-in was cancelled");
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithMessage(req, "error", "The connection request expired or was invalid — try again");
  }

  try {
    await completeConnect(session.user.organisationId, session.user.id, code);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "google_drive.connect",
      entityType: "GoogleDriveConnection",
    });

    return redirectWithMessage(req, "connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to connect Google Drive";
    return redirectWithMessage(req, "error", message);
  }
}
