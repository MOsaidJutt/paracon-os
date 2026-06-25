import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { assertInList } from "@/lib/config";
import { issueRaiseSchema } from "@/lib/validations/site-update";
import { ensureDailyUpdateForCapture } from "@/lib/site/daily-update-service";
import { loadSiteConfig } from "@/lib/site/config";

/** "One screen, severity chips, photo, send" — raised independently of the day's final submit, idempotent on clientRef. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("site.update");
    const db = getTenantContext(session.user.organisationId);
    const body = issueRaiseSchema.parse(await req.json());

    if (body.clientRef) {
      const existing = await db.issue.findFirst({ where: { clientRef: body.clientRef }, include: { photos: true } });
      if (existing) return NextResponse.json({ issue: existing });
    }

    const siteConfig = await loadSiteConfig(session.user.organisationId);
    assertInList(body.severity, siteConfig.issueSeverityList, "severity");

    const dailyUpdate = await ensureDailyUpdateForCapture(
      db,
      session.user.organisationId,
      session.user.id,
      body.projectId,
      body.date
    );

    const issue = await db.issue.create({
      data: {
        organisationId: session.user.organisationId,
        projectId: body.projectId,
        dailySiteUpdateId: dailyUpdate.id,
        raisedByUserId: session.user.id,
        description: body.description,
        severity: body.severity,
        clientRef: body.clientRef ?? null,
      },
    });

    if (body.photoStoredFileIds.length > 0) {
      await db.storedFile.updateMany({
        where: { id: { in: body.photoStoredFileIds }, projectId: body.projectId },
        data: { issueId: issue.id },
      });
    }

    const issueWithPhotos = await db.issue.findFirst({ where: { id: issue.id }, include: { photos: true } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "site.issue.create",
      entityType: "Issue",
      entityId: issue.id,
      after: { projectId: body.projectId, severity: body.severity },
    });

    return NextResponse.json({ issue: issueWithPhotos }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
