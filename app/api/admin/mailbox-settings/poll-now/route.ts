import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { sendEvent } from "@/lib/inngest/send-safe";

/** Manual "poll now" trigger — local/demo environments have no real 5-minute scheduler running. */
export async function POST() {
  try {
    await requirePermission("admin.settings");
    await sendEvent("mailbox/poll.requested");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
