import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { listModulesForOrg, setModuleEnabled } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { z } from "zod";

const patchSchema = z.object({ moduleId: z.string().min(1), enabled: z.boolean() });

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("platform.superadmin");
    const modules = await listModulesForOrg(params.id);
    return NextResponse.json({ modules });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("platform.superadmin");
    const body = patchSchema.parse(await req.json());

    const targetModule = await prisma.module.findUnique({ where: { id: body.moduleId } });
    if (!targetModule) return NextResponse.json({ error: "Module not found" }, { status: 404 });

    await setModuleEnabled(params.id, body.moduleId, body.enabled);

    await auditLog({
      organisationId: params.id,
      userId: session.user.id,
      action: "module.toggle",
      entityType: "Module",
      entityId: targetModule.id,
      after: { slug: targetModule.slug, enabled: body.enabled, byPlatformAdmin: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
