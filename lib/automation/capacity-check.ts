import { prisma } from "@/lib/prisma";
import type { CapacityHeadroom, ShortageEntry } from "@/lib/forecast/engine";

export type CapacityShortageReport = {
  hasShortage: boolean;
  shortages: ShortageEntry[];
  /** Pre-formatted HTML fragment ready to embed in a notification email. */
  summaryHtml: string;
};

/**
 * Reads the persisted ForecastSnapshot for the org and checks headroomJson for
 * capacity shortages. Returns immediately if no snapshot exists yet (first run
 * before any recompute has completed).
 */
export async function checkCapacityShortages(organisationId: string): Promise<CapacityShortageReport> {
  const snapshot = await prisma.forecastSnapshot.findUnique({ where: { organisationId } });
  if (!snapshot) {
    return { hasShortage: false, shortages: [], summaryHtml: "<p>No forecast data available yet.</p>" };
  }

  const headroom = snapshot.headroomJson as CapacityHeadroom;
  const shortages: ShortageEntry[] = headroom.shortages ?? [];

  if (shortages.length === 0) {
    return { hasShortage: false, shortages: [], summaryHtml: "<p>No capacity shortages detected.</p>" };
  }

  // Group shortages by role so the email shows one bullet per trade, not one per block.
  const byRole = shortages.reduce<Record<string, string[]>>((acc, s) => {
    (acc[s.role] ??= []).push(`${s.blockLabel} (gap: ${Math.abs(s.gap)} head${Math.abs(s.gap) === 1 ? "" : "s"})`);
    return acc;
  }, {});

  const rows = Object.entries(byRole)
    .map(([role, periods]) => `<li><strong>${role}:</strong> ${periods.join(", ")}</li>`)
    .join("");
  const summaryHtml = `<ul>${rows}</ul>`;

  return { hasShortage: true, shortages, summaryHtml };
}
