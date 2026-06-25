import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { siteTodayQuerySchema } from "@/lib/validations/site-update";
import { getSiteTodayContext, todayDateOnly } from "@/lib/site/daily-update-service";
import { loadSiteConfig } from "@/lib/site/config";
import { loadFinanceConfig } from "@/lib/finance/config";

/** Everything the foreman mobile flow needs for one screen load: their project, today's tasks/deliveries, suggested crew, and any draft already started today. */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("site.update");
    const db = getTenantContext(session.user.organisationId);

    const query = siteTodayQuerySchema.parse({ date: req.nextUrl.searchParams.get("date") ?? undefined });
    const date = query.date ?? todayDateOnly();

    const [context, siteConfig, financeConfig] = await Promise.all([
      getSiteTodayContext(db, session.user.organisationId, session.user.id, date),
      loadSiteConfig(session.user.organisationId),
      loadFinanceConfig(session.user.organisationId),
    ]);

    return NextResponse.json({
      ...context,
      config: { ...siteConfig, deliveryStatusList: financeConfig.deliveryStatusList },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
