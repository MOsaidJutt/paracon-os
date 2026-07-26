import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { auditLog } from "@/lib/audit";
import { BadRequestError } from "@/lib/errors";
import { loadSimpleDashboardConfig } from "@/lib/dashboard/simple-config";
import { buildChecklist, activePeriodKeys, periodKeyFor } from "@/lib/dashboard/checklist";
import { prisma } from "@/lib/prisma";

const tickSchema = z.object({
  itemKey: z.string().min(1).max(60),
  done: z.boolean(),
});

/** A user's own checklist for the current day/week. No permission slug: everyone gets their own checks. */
export async function GET() {
  try {
    const session = await requireSession();
    const now = new Date();

    const [config, ticks] = await Promise.all([
      loadSimpleDashboardConfig(session.user.organisationId),
      prisma.kpiChecklistTick.findMany({
        where: {
          organisationId: session.user.organisationId,
          userId: session.user.id,
          periodKey: { in: activePeriodKeys(now) },
        },
        select: { itemKey: true, periodKey: true },
      }),
    ]);

    return NextResponse.json({ checklist: buildChecklist(config.checklistItems, ticks, now) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Tick or untick one item for its current period. Ticking is an upsert and
 * unticking a delete, so double-taps on a phone settle on the state the user
 * last asked for rather than toggling twice.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { itemKey, done } = tickSchema.parse(await req.json());
    const { organisationId, id: userId } = session.user;
    const now = new Date();

    const config = await loadSimpleDashboardConfig(organisationId);
    const item = config.checklistItems.find((i) => i.key === itemKey);
    // Reject unknown keys outright: without this, a stale client could write
    // rows for items an admin has since deleted, which would then never clear.
    if (!item) throw new BadRequestError("That checklist item no longer exists. Refresh the page.");

    const periodKey = periodKeyFor(item.cadence, now);
    const where = {
      organisationId_userId_itemKey_periodKey: { organisationId, userId, itemKey, periodKey },
    };

    if (done) {
      await prisma.kpiChecklistTick.upsert({
        where,
        update: { tickedAt: now },
        create: { organisationId, userId, itemKey, periodKey, tickedAt: now },
      });
    } else {
      await prisma.kpiChecklistTick.deleteMany({ where: { organisationId, userId, itemKey, periodKey } });
    }

    await auditLog({
      organisationId,
      userId,
      action: done ? "kpi_checklist.tick" : "kpi_checklist.untick",
      entityType: "KpiChecklistTick",
      entityId: `${itemKey}:${periodKey}`,
      after: { itemKey, periodKey, done },
    });

    return NextResponse.json({ itemKey, periodKey, done });
  } catch (error) {
    return toErrorResponse(error);
  }
}
