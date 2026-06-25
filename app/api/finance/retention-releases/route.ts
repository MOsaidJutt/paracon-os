import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { createRetentionReleaseSchema } from "@/lib/validations/retention-release";
import { createRetentionRelease, listRetentionReleases } from "@/lib/finance/retention-release-service";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("finance.view");
    const db = getTenantContext(session.user.organisationId);

    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

    const releases = await listRetentionReleases(db, projectId);
    return NextResponse.json({ releases });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("finance.approve");
    const db = getTenantContext(session.user.organisationId);
    const body = createRetentionReleaseSchema.parse(await req.json());

    const release = await createRetentionRelease(db, session.user.organisationId, session.user.id, body);
    return NextResponse.json({ release }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
