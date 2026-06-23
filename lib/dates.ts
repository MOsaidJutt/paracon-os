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
