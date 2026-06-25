import type { DashboardHealthConfig } from "./config";

export type ProjectHealthStatus = "On Track" | "Attention" | "Critical";

export type ProjectHealthInput = {
  now: Date;
  // Milestone is only ever created from a critical ProgramActivity (see
  // lib/projects/calculations.ts's deriveMilestones), so every date here is
  // already a critical date — no separate "isCritical" filter needed.
  milestoneDates: Date[];
  openIssueSeverities: string[];
  // Index 0 = current ISO week, index 1 = next week, etc. Positive = shortage.
  weeklyShortfall: number[];
};

export type ProjectHealthResult = {
  status: ProjectHealthStatus;
  reasons: string[];
};

/**
 * Derives a project's RAG health for the Director/PM dashboards. Critical
 * trumps Attention trumps On Track — a project can trigger several reasons
 * at once, all are surfaced, but the worst one decides the status.
 */
export function computeProjectHealth(input: ProjectHealthInput, config: DashboardHealthConfig): ProjectHealthResult {
  const reasons: string[] = [];
  let critical = false;
  let attention = false;

  const overdue = input.milestoneDates.filter((d) => d < input.now);
  if (overdue.length > 0) {
    critical = true;
    reasons.push(`${overdue.length} critical date${overdue.length > 1 ? "s" : ""} overdue`);
  }

  const attentionWindowEnd = new Date(input.now.getTime() + config.attentionMilestoneWindowDays * 86_400_000);
  const upcoming = input.milestoneDates.filter((d) => d >= input.now && d <= attentionWindowEnd);
  if (upcoming.length > 0) {
    attention = true;
    reasons.push(`Critical date within ${config.attentionMilestoneWindowDays} days`);
  }

  const criticalIssueCount = input.openIssueSeverities.filter((s) =>
    config.criticalIssueSeverities.includes(s)
  ).length;
  if (criticalIssueCount > 0) {
    critical = true;
    reasons.push(`${criticalIssueCount} open issue${criticalIssueCount > 1 ? "s" : ""} at critical severity`);
  } else if (input.openIssueSeverities.length > 0) {
    attention = true;
    reasons.push(`${input.openIssueSeverities.length} open issue${input.openIssueSeverities.length > 1 ? "s" : ""}`);
  }

  const thisWeekShortfall = input.weeklyShortfall[0] ?? 0;
  if (thisWeekShortfall > 0) {
    critical = true;
    reasons.push(`Labour shortfall this week (${thisWeekShortfall} short)`);
  } else if (input.weeklyShortfall.slice(0, config.shortageWatchWeeks).some((s) => s > 0)) {
    attention = true;
    reasons.push(`Labour shortfall within ${config.shortageWatchWeeks} weeks`);
  }

  return { status: critical ? "Critical" : attention ? "Attention" : "On Track", reasons };
}
