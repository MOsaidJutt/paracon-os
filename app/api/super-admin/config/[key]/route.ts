import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { setPlatformConfig } from "@/lib/config";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { configValueSchemas, updateConfigSchema } from "@/lib/validations/config";

export async function PATCH(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    const session = await requirePermission("platform.superadmin");

    const platformDefault = await prisma.config.findFirst({ where: { organisationId: null, key: params.key } });
    if (!platformDefault) return NextResponse.json({ error: "Unknown config key" }, { status: 404 });

    const body = updateConfigSchema.parse(await req.json());
    const valueSchema = configValueSchemas[platformDefault.type as keyof typeof configValueSchemas];
    const parsed = valueSchema.safeParse(body.value);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid value for this config type", issues: parsed.error.flatten() }, { status: 400 });
    }

    await setPlatformConfig(params.key, parsed.data, session.user.id);

    await auditLog({
      organisationId: null,
      userId: session.user.id,
      action: "config.platform_update",
      entityType: "Config",
      entityId: params.key,
      after: { value: parsed.data },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
