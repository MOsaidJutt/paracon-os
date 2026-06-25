import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { rateLimit } from "@/lib/rate-limit";
import { testMailboxSetting } from "@/lib/finance/mailbox-settings-service";

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("admin.settings");

    const { ok: withinLimit } = rateLimit(`mailbox-test:${session.user.organisationId}`, 10, 60_000);
    if (!withinLimit) {
      return NextResponse.json({ error: "Too many test requests, try again shortly" }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    await testMailboxSetting(session.user.organisationId, body.password ? { password: body.password } : undefined);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
