import { NextResponse } from "next/server";
import { requireSessionWithPermissions } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { getPreference } from "@/lib/preferences";
import { getSimpleDashboard } from "@/lib/dashboard/simple-service";
import { KPI_SLOT_PREFERENCE_KEY } from "@/lib/dashboard/kpi-slots";

/**
 * The simplified dashboard reading.
 *
 * No single permission gates this route, because it's the page every role
 * lands on. Instead the service is handed the caller's freshly-read permission
 * slugs and returns only the sections those slugs allow — an estimator gets
 * pipeline rings and no capacity card, a viewer gets project health and no
 * worker KPIs. Every underlying record still comes from a tenant-scoped query.
 */
export async function GET() {
  try {
    const session = await requireSessionWithPermissions();
    const { organisationId, id: userId, permissions } = session.user;

    const savedRingSlots = await getPreference<unknown>(
      organisationId,
      userId,
      KPI_SLOT_PREFERENCE_KEY,
      (value) => value
    );

    const dashboard = await getSimpleDashboard(organisationId, userId, permissions, savedRingSlots);

    return NextResponse.json(dashboard);
  } catch (error) {
    return toErrorResponse(error);
  }
}
