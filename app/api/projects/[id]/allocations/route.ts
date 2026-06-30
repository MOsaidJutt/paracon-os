import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { weekKey, weekSequence } from "@/lib/dates";
import { loadForecastConfig } from "@/lib/forecast/config";
import { buildBlocks, classifyRag } from "@/lib/forecast/engine";
import { aggregateLabourDemand, aggregateAllocatedByTrade } from "@/lib/projects/calculations";

/**
 * Resource Planner data for one project: required (Phase 5 demand, scoped to
 * this project's program) vs allocated (this phase's Allocation rows), by
 * trade, at both week granularity (the drag-drop grid) and block granularity
 * (the at-a-glance summary, using the same RAG thresholds/classifier as the
 * Phase 5 forecast matrix so the colours mean the same thing in both places).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("allocation.edit");
    const db = getTenantContext(session.user.organisationId);
    const now = new Date();

    const project = await db.project.findFirst({ where: { id: params.id } });
    if (!project) throw new NotFoundError("Project not found");

    const forecastConfig = await loadForecastConfig(session.user.organisationId);
    const horizonWeeks = weekSequence(now, forecastConfig.weeksOut);
    const horizonWeekKeys = horizonWeeks.map(weekKey);
    const horizonStart = horizonWeeks[0];
    const horizonEnd = horizonWeeks[horizonWeeks.length - 1];

    const [activities, allocations] = await Promise.all([
      db.programActivity.findMany({
        where: { projectId: params.id, endDate: { gte: now } },
        select: { id: true, parentId: true, startDate: true, endDate: true, labourRequired: true },
      }),
      db.allocation.findMany({
        where: { projectId: params.id, weekStart: { gte: horizonStart, lte: horizonEnd } },
        select: {
          id: true,
          weekStart: true,
          worker: { select: { id: true, name: true, photoUrl: true, capability: true } },
        },
      }),
    ]);

    const required = aggregateLabourDemand(
      activities.map((a) => ({ ...a, labourRequired: a.labourRequired as Record<string, number> }))
    );
    const allocated = aggregateAllocatedByTrade(
      allocations.map((a) => ({ weekStart: a.weekStart, trade: a.worker.capability }))
    );

    const roles = Array.from(
      new Set([...Object.values(required).flatMap((r) => Object.keys(r)), ...allocations.map((a) => a.worker.capability)])
    ).sort();

    type AllocationChip = { allocationId: string; workerId: string; name: string; photoUrl: string | null };
    const weekly: Record<string, Record<string, { required: number; workers: AllocationChip[] }>> = {};
    for (const week of horizonWeekKeys) {
      weekly[week] = {};
      for (const role of roles) {
        weekly[week][role] = { required: required[week]?.[role] ?? 0, workers: [] };
      }
    }
    for (const allocation of allocations) {
      const week = weekKey(allocation.weekStart);
      const role = allocation.worker.capability;
      weekly[week]?.[role]?.workers.push({
        allocationId: allocation.id,
        workerId: allocation.worker.id,
        name: allocation.worker.name,
        photoUrl: allocation.worker.photoUrl,
      });
    }

    const blocks = buildBlocks(now, forecastConfig.blockLengthDays, forecastConfig.weeksOut);
    const blockCells = roles.flatMap((role) =>
      blocks.map((block) => {
        const requiredSum = block.weeks.reduce((sum, week) => sum + (required[week]?.[role] ?? 0), 0);
        const allocatedSum = block.weeks.reduce((sum, week) => sum + (allocated[week]?.[role] ?? 0), 0);
        const { status, severity } = classifyRag(requiredSum, allocatedSum, forecastConfig.ragThresholds);
        return {
          role,
          blockIndex: block.index,
          blockLabel: block.label,
          required: requiredSum,
          allocated: allocatedSum,
          status,
          severity,
        };
      })
    );

    return NextResponse.json({
      projectId: params.id,
      weeks: horizonWeekKeys,
      blocks: blocks.map((b) => ({ index: b.index, label: b.label, weeks: b.weeks })),
      roles,
      weekly,
      blockCells,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
