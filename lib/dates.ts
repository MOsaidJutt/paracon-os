/** Monday of the ISO week containing `date`, at UTC midnight — the canonical week key used across program/forecast aggregation. */
export function startOfIsoWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d;
}

/** Stable string key (the Monday of `date`'s ISO week) for grouping weekly maps. */
export function weekKey(date: Date): string {
  return startOfIsoWeek(date).toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** `count` consecutive ISO-week Mondays starting from the week containing `from`. */
export function weekSequence(from: Date, count: number): Date[] {
  const start = startOfIsoWeek(from);
  return Array.from({ length: count }, (_, i) => addDays(start, i * 7));
}

/** First of the calendar month containing `date`, at UTC midnight — the canonical month key for StaffScore/ProductivityRecord. */
export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Exclusive end of the calendar month containing `date` (i.e. the first of the next month), at UTC midnight. */
export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

/** Stable "YYYY-MM" string key for a calendar month, used in query params and as a UI label. */
export function monthKey(date: Date): string {
  return startOfMonth(date).toISOString().slice(0, 7);
}

/** Number of whole calendar days `[from, to)` overlaps `periodStart`/`periodEnd` — used to prorate planned hours into a partial month. */
export function overlapDays(periodStart: Date, periodEnd: Date, from: Date, to: Date): number {
  const start = Math.max(periodStart.getTime(), from.getTime());
  const end = Math.min(periodEnd.getTime(), to.getTime());
  if (end <= start) return 0;
  return Math.round((end - start) / 86_400_000);
}
