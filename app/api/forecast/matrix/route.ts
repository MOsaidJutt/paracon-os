import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { computeForecastResult } from "@/lib/forecast/snapshot";

/**
 * A pure read: always recomputes live so the matrix/heatmap reflect the
 * current program, pipeline and labour state immediately (no waiting on the
 * Inngest job), but never writes the ForecastSnapshot row itself — a GET
 * silently mutating state on every page view would need an audit-log entry
 * per CLAUDE.md rule 6, which is the wrong shape for a read. Persisting the
 * snapshot is reserved for the explicit recompute action and the Inngest job.
 */
export async function GET() {
  try {
    const session = await requirePermission("forecast.view");
    const result = await computeForecastResult(session.user.organisationId);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
