import type { TenantContext } from "@/lib/tenant";
import { NotFoundError, ForbiddenError, BadRequestError } from "@/lib/errors";
import { assertInList } from "@/lib/config";
import { loadSiteConfig } from "./config";
import { loadFinanceConfig } from "@/lib/finance/config";
import type { DailyUpdateSubmitInput } from "@/lib/validations/site-update";

/** Parses a "YYYY-MM-DD" client-local date into a UTC-midnight Date — the canonical day key used across this feature. */
export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The single project a foreman lands on with zero taps. Null if nobody has assigned them one yet. */
export async function resolveForemanProject(db: TenantContext, foremanUserId: string) {
  return db.project.findFirst({
    where: { foremanUserId },
    orderBy: { startDate: "asc" },
    select: { id: true, name: true, code: true, address: true },
  });
}

/** Throws if the calling foreman isn't the one assigned to this project — a foreman may only ever update their own site. */
function assertForemanOwnsProject(project: { foremanUserId: string | null }, foremanUserId: string): void {
  if (project.foremanUserId !== foremanUserId) {
    throw new ForbiddenError("site.update");
  }
}

async function getOrCreateDailyUpdate(
  db: TenantContext,
  organisationId: string,
  projectId: string,
  foremanUserId: string,
  date: Date
) {
  const existing = await db.dailySiteUpdate.findFirst({
    where: { projectId, foremanUserId, date },
  });
  if (existing) return existing;

  return db.dailySiteUpdate.create({
    data: { organisationId, projectId, foremanUserId, date },
  });
}

/**
 * Pure decision rule behind "default to yesterday's crew": prefer the most
 * recent prior update's present workers; fall back to this week's Resource
 * Planner allocation only when no prior update exists yet (the very first
 * time this project is used).
 */
export function deriveSuggestedAttendance(
  priorAttendance: { workerId: string; present: boolean }[] | null,
  allocatedWorkerIds: string[]
): { workerId: string; present: boolean }[] {
  if (priorAttendance) {
    return priorAttendance.filter((a) => a.present).map((a) => ({ workerId: a.workerId, present: true }));
  }
  return allocatedWorkerIds.map((workerId) => ({ workerId, present: true }));
}

export async function resolveSuggestedAttendance(
  db: TenantContext,
  projectId: string,
  date: Date
): Promise<{ workerId: string; present: boolean }[]> {
  const priorUpdate = await db.dailySiteUpdate.findFirst({
    where: { projectId, date: { lt: date } },
    orderBy: { date: "desc" },
    include: { attendance: { select: { workerId: true, present: true } } },
  });

  if (priorUpdate) return deriveSuggestedAttendance(priorUpdate.attendance, []);

  const { startOfIsoWeek } = await import("@/lib/dates");
  const weekStart = startOfIsoWeek(date);
  const allocations = await db.allocation.findMany({ where: { projectId, weekStart }, select: { workerId: true } });
  return deriveSuggestedAttendance(null, allocations.map((a) => a.workerId));
}

export type SiteTodayContext = Awaited<ReturnType<typeof getSiteTodayContext>>;

export async function getSiteTodayContext(db: TenantContext, organisationId: string, foremanUserId: string, dateStr: string) {
  const project = await resolveForemanProject(db, foremanUserId);
  const date = parseDateOnly(dateStr);

  if (!project) {
    return { project: null, date: dateStr, activities: [], deliveries: [], workers: [], suggestedAttendance: [], existingUpdate: null };
  }

  // Activity start/end dates can carry a time-of-day component (whenever
  // they were created), so "active on `date`" must be a full-day window
  // comparison — not an instant-vs-midnight one, or same-day activities
  // created later than midnight would be wrongly excluded.
  const dayEnd = new Date(date.getTime() + 86_400_000);

  const [activities, deliveries, workers, suggestedAttendance, existingUpdate] = await Promise.all([
    db.programActivity.findMany({
      where: { projectId: project.id, startDate: { lt: dayEnd }, endDate: { gte: date } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, trade: true, status: true },
    }),
    db.delivery.findMany({
      where: { projectId: project.id, status: { not: "Delivered" } },
      orderBy: { expectedDate: "asc" },
      include: { supplier: { select: { id: true, company: true } } },
    }),
    db.worker.findMany({
      where: { organisationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, capability: true },
    }),
    resolveSuggestedAttendance(db, project.id, date),
    db.dailySiteUpdate.findFirst({
      where: { projectId: project.id, foremanUserId, date },
      include: {
        attendance: true,
        taskProgress: true,
        issues: { include: { photos: { select: { id: true, key: true, caption: true } } } },
        photos: { where: { issueId: null }, select: { id: true, key: true, caption: true, tagsJson: true } },
      },
    }),
  ]);

  return { project, date: dateStr, activities, deliveries, workers, suggestedAttendance, existingUpdate };
}

export async function submitDailyUpdate(
  db: TenantContext,
  organisationId: string,
  foremanUserId: string,
  input: DailyUpdateSubmitInput
) {
  const project = await db.project.findFirst({ where: { id: input.projectId } });
  if (!project) throw new NotFoundError("Project not found");
  assertForemanOwnsProject(project, foremanUserId);

  const [siteConfig, financeConfig] = await Promise.all([
    loadSiteConfig(organisationId),
    loadFinanceConfig(organisationId),
  ]);

  for (const t of input.taskProgress) assertInList(t.status, siteConfig.activityStatusList, "taskProgress.status");
  for (const d of input.deliveryConfirmations) assertInList(d.status, financeConfig.deliveryStatusList, "deliveryConfirmations.status");

  const date = parseDateOnly(input.date);

  return db.$transaction(async (tx) => {
    const existingDailyUpdate = await tx.dailySiteUpdate.findFirst({
      where: { organisationId, projectId: project.id, foremanUserId, date },
    });
    const dailyUpdate =
      existingDailyUpdate ??
      (await tx.dailySiteUpdate.create({ data: { organisationId, projectId: project.id, foremanUserId, date } }));

    for (const item of input.attendance) {
      const worker = await tx.worker.findFirst({ where: { id: item.workerId, organisationId } });
      if (!worker) throw new NotFoundError(`Worker ${item.workerId} not found`);
      await tx.attendance.upsert({
        where: { dailySiteUpdateId_workerId: { dailySiteUpdateId: dailyUpdate.id, workerId: item.workerId } },
        update: { present: item.present, hours: item.hours ?? null },
        create: { dailySiteUpdateId: dailyUpdate.id, workerId: item.workerId, present: item.present, hours: item.hours ?? null },
      });
    }

    for (const item of input.taskProgress) {
      const activity = await tx.programActivity.findFirst({ where: { id: item.programActivityId, projectId: project.id } });
      if (!activity) throw new NotFoundError(`Activity ${item.programActivityId} not found on this project`);
      await tx.taskProgress.upsert({
        where: { dailySiteUpdateId_programActivityId: { dailySiteUpdateId: dailyUpdate.id, programActivityId: item.programActivityId } },
        update: { status: item.status, note: item.note ?? null },
        create: { dailySiteUpdateId: dailyUpdate.id, programActivityId: item.programActivityId, status: item.status, note: item.note ?? null },
      });
      await tx.programActivity.update({ where: { id: activity.id }, data: { status: item.status } });
    }

    for (const item of input.deliveryConfirmations) {
      const delivery = await tx.delivery.findFirst({ where: { id: item.deliveryId, projectId: project.id } });
      if (!delivery) throw new NotFoundError(`Delivery ${item.deliveryId} not found on this project`);
      await tx.delivery.update({
        where: { id: delivery.id },
        data: {
          status: item.status,
          deliveredDate: item.status === "Delivered" ? date : delivery.deliveredDate,
          dailySiteUpdateId: dailyUpdate.id,
        },
      });
    }

    return tx.dailySiteUpdate.update({
      where: { id: dailyUpdate.id },
      data: { note: input.note ?? null, submittedAt: new Date() },
      include: { attendance: true, taskProgress: true },
    });
  });
}

/** Get-or-create the day's update on behalf of a standalone photo/issue capture — independent of the final submit. */
export async function ensureDailyUpdateForCapture(
  db: TenantContext,
  organisationId: string,
  foremanUserId: string,
  projectId: string,
  dateStr: string
) {
  const project = await db.project.findFirst({ where: { id: projectId } });
  if (!project) throw new NotFoundError("Project not found");
  assertForemanOwnsProject(project, foremanUserId);

  return getOrCreateDailyUpdate(db, organisationId, project.id, foremanUserId, parseDateOnly(dateStr));
}

export function assertNonEmptyFile(size: number, maxBytes: number): void {
  if (size === 0) throw new BadRequestError("Empty file");
  if (size > maxBytes) throw new BadRequestError(`File must be under ${Math.round(maxBytes / 1024 / 1024)}MB`);
}
