import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError } from "@/lib/errors";
import { mintOrgAccessToken } from "@/lib/google-drive/service";

/** Mints a short-lived, drive.file-scoped access token for the Google Picker widget — the only place a real Drive access token reaches the browser, and it can only browse files/folders OneParacon itself created or that the user previously picked. */
export async function POST() {
  try {
    const session = await requirePermission("doc.edit");
    if (!process.env.NEXT_PUBLIC_GOOGLE_API_KEY) {
      throw new BadRequestError("Google Picker is not configured — set NEXT_PUBLIC_GOOGLE_API_KEY");
    }
    const accessToken = await mintOrgAccessToken(session.user.organisationId);
    return NextResponse.json({ accessToken, apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY });
  } catch (error) {
    return toErrorResponse(error);
  }
}
