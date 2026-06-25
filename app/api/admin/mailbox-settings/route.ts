import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { upsertMailboxSettingSchema } from "@/lib/validations/mailbox-setting";
import { getMailboxSetting, upsertMailboxSetting } from "@/lib/finance/mailbox-settings-service";

export async function GET() {
  try {
    const session = await requirePermission("admin.settings");
    const setting = await getMailboxSetting(session.user.organisationId);
    return NextResponse.json({ setting });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermission("admin.settings");
    const body = upsertMailboxSettingSchema.parse(await req.json());

    const setting = await upsertMailboxSetting(session.user.organisationId, session.user.id, body);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "mailbox_setting.update",
      entityType: "MailboxSetting",
      entityId: setting.id,
      after: { host: setting.host, username: setting.username, enabled: setting.enabled },
    });

    return NextResponse.json({ setting });
  } catch (error) {
    return toErrorResponse(error);
  }
}
