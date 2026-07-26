import { z } from "zod";
import { startOfIsoWeek } from "@/lib/dates";

/**
 * The daily/weekly KPI checklist on the simplified dashboard.
 *
 * The items are CONFIG, NOT CODE: they live in the "dashboard.checklist.items"
 * Config row and are edited from the admin settings registry, so a new check
 * is a settings change rather than a migration. Only the ticks are rows
 * (KpiChecklistTick), and a tick is scoped to the period it belongs to, so it
 * lapses on its own when the day or week rolls over instead of needing a
 * scheduled reset job.
 */
export const CHECKLIST_CADENCES = ["DAILY", "WEEKLY"] as const;
export type ChecklistCadence = (typeof CHECKLIST_CADENCES)[number];

export const checklistItemSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  cadence: z.enum(CHECKLIST_CADENCES),
});
export const checklistItemsSchema = z.array(checklistItemSchema);
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export type ChecklistEntry = ChecklistItem & { periodKey: string; done: boolean };

/**
 * The bucket a tick belongs to: the calendar date for a daily item, the ISO
 * week's Monday for a weekly one. Deriving this rather than storing a
 * "resets at" timestamp means a tick made last Tuesday simply stops matching
 * once the week turns over, with no background job involved.
 */
export function periodKeyFor(cadence: ChecklistCadence, now: Date): string {
  if (cadence === "WEEKLY") return `W${startOfIsoWeek(now).toISOString().slice(0, 10)}`;
  return now.toISOString().slice(0, 10);
}

/** Combines the configured items with this user's ticks for the current period. */
export function buildChecklist(
  items: ChecklistItem[],
  ticks: { itemKey: string; periodKey: string }[],
  now: Date
): ChecklistEntry[] {
  const ticked = new Set(ticks.map((t) => `${t.itemKey}::${t.periodKey}`));

  return items.map((item) => {
    const periodKey = periodKeyFor(item.cadence, now);
    return { ...item, periodKey, done: ticked.has(`${item.key}::${periodKey}`) };
  });
}

/** Every period key currently in play, for a single indexed query rather than one per item. */
export function activePeriodKeys(now: Date): string[] {
  return CHECKLIST_CADENCES.map((cadence) => periodKeyFor(cadence, now));
}
