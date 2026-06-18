import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { testAiSetting } from "@/lib/ai";
import { toErrorResponse } from "@/lib/api-error";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("admin.ai");

    const { ok: withinLimit } = rateLimit(`ai-test:${session.user.organisationId}`, 10, 60_000);
    if (!withinLimit) {
      return NextResponse.json({ error: "Too many test requests, try again shortly" }, { status: 429 });
    }

    const result = await testAiSetting(params.id, session.user.organisationId);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
