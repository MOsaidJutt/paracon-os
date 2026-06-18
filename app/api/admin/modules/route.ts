import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { listModulesForOrg, setModuleEnabled } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { z } from "zod";

const patchSchema = z.object({ moduleId: z.string().min(1), enabled: z.boolean() });

export async function GET() {
  try {
    const session = await requirePermission("admin.modules");
    const modules = await listModulesForOrg(session.user.organisationId);
    return NextResponse.json({ modules });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requirePermission("admin.modules");
    const body = patchSchema.parse(await req.json());

    const targetModule = await prisma.module.findUnique({ where: { id: body.moduleId } });
    if (!targetModule) return NextResponse.json({ error: "Module not found" }, { status: 404 });

    await setModuleEnabled(session.user.organisationId, body.moduleId, body.enabled);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "module.toggle",
      entityType: "Module",
      entityId: targetModule.id,
      after: { slug: targetModule.slug, enabled: body.enabled },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
