import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { startConnect } from "@/lib/google-drive/service";

export const OAUTH_STATE_COOKIE = "gdrive_oauth_state";

/** Redirects the admin's browser to Google's consent screen. A random nonce (not the org id) is sent as `state` and mirrored in an httpOnly cookie so the callback can confirm the response came from a redirect we issued. */
export async function GET() {
  try {
    await requirePermission("admin.settings");
    const nonce = randomUUID();
    const url = startConnect(nonce);

    const res = NextResponse.redirect(url);
    res.cookies.set(OAUTH_STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  } catch (error) {
    return toErrorResponse(error);
  }
}
