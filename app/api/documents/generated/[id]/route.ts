import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { assertInList, getConfig } from "@/lib/config";

const patchSchema = z.object({ status: z.string().min(1) });

/** Status is the real, queryable replacement for the source Drive structure's folder-name-encoded "Withdrawn" state. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("doc.generate");
    const db = getTenantContext(session.user.organisationId);
    const body = patchSchema.parse(await req.json());

    const statusList = await getConfig<string[]>("document.generatedStatusList", session.user.organisationId);
    assertInList(body.status, statusList, "status");

    const existing = await db.generatedDocument.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Generated document not found");

    const document = await db.generatedDocument.update({
      where: { id: params.id },
      data: { status: body.status },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "document.generated.status_update",
      entityType: "GeneratedDocument",
      entityId: document.id,
      before: { status: existing.status },
      after: { status: document.status },
    });

    return NextResponse.json({ document });
  } catch (error) {
    return toErrorResponse(error);
  }
}
