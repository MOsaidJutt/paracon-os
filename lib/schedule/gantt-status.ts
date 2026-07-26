import { RAG_BAND_HEX, type RagBand } from "@/lib/dashboard/rag";

export type GanttStatus = "On Track" | "At Risk" | "Behind";

export type GanttStatusInput = {
  today: Date;
  currentEndDate: Date;
  isComplete: boolean;
};

const DAY_MS = 86_400_000;

const STATUS_BAND: Record<GanttStatus, RagBand> = {
  "On Track": "good",
  "At Risk": "warning",
  Behind: "bad",
};

export function ganttStatusColor(status: GanttStatus): string {
  return RAG_BAND_HEX[STATUS_BAND[status]];
}

/**
 * Per the client's exact spec (FEEDBACK_NOTES.md "TRAFFIC-LIGHT status derived
 * from the today line"): On Track when the current bar reaches/passes today,
 * At Risk under the threshold, Behind at or beyond it. A completed activity
 * is always On Track — a late finish that's already delivered isn't a live risk.
 */
export function computeGanttStatus(input: GanttStatusInput, atRiskThresholdDays: number): GanttStatus {
  if (input.isComplete) return "On Track";

  const daysPastToday = Math.floor((input.today.getTime() - input.currentEndDate.getTime()) / DAY_MS);
  if (daysPastToday <= 0) return "On Track";
  if (daysPastToday < atRiskThresholdDays) return "At Risk";
  return "Behind";
}

/** Current vs. most recent baseline end date, in days. Positive = slipped later. Null when the project has no baseline yet. */
export function computeDelayDays(baselineEndDate: Date | null, currentEndDate: Date): number | null {
  if (!baselineEndDate) return null;
  return Math.round((currentEndDate.getTime() - baselineEndDate.getTime()) / DAY_MS);
}
