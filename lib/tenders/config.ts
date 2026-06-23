import { assertInList, getConfig } from "@/lib/config";

export { assertInList };

export type ValueBand = { label: string; max: number | null };

export type TenderConfig = {
  statusList: string[];
  outcomeList: string[];
  winProbWeights: Record<string, number>;
  statusWeights: Record<string, number>;
  valueBands: ValueBand[];
  clientStatusList: string[];
  bidDecisionList: string[];
  intentList: string[];
};

/** Loads every Config-driven list/weight the tender pipeline depends on, resolved for this org. */
export async function loadTenderConfig(organisationId: string): Promise<TenderConfig> {
  const [statusList, outcomeList, winProbWeights, statusWeights, valueBands, clientStatusList, bidDecisionList, intentList] =
    await Promise.all([
      getConfig<string[]>("tender.statusList", organisationId),
      getConfig<string[]>("tender.outcomeList", organisationId),
      getConfig<Record<string, number>>("tender.winProbWeights", organisationId),
      getConfig<Record<string, number>>("tender.statusWeights", organisationId),
      getConfig<ValueBand[]>("tender.valueBands", organisationId),
      getConfig<string[]>("client.statusList", organisationId),
      getConfig<string[]>("tender.bidDecisionList", organisationId),
      getConfig<string[]>("tender.intentList", organisationId),
    ]);
  return { statusList, outcomeList, winProbWeights, statusWeights, valueBands, clientStatusList, bidDecisionList, intentList };
}

/** Resolves a value into its band label using the lowest threshold the value doesn't exceed. */
export function resolveValueBand(value: number, bands: ValueBand[]): string {
  for (const band of bands) {
    if (band.max === null || value <= band.max) return band.label;
  }
  return bands[bands.length - 1]?.label ?? "";
}

function quarterOf(date: Date): string {
  return `Q${Math.floor(date.getMonth() / 3) + 1}`;
}

/**
 * Computes the fields the spreadsheet derives via formula rather than manual
 * entry: winProbabilityNumeric (from the win-probability text), valueBand
 * (from the value-band thresholds), year/quarter (from the received date,
 * falling back to today so a tender always lands in a period), and
 * tenderDurationDays (due - received, mirroring the xlsx's duration column).
 */
export function deriveTenderComputedFields(
  input: { value: number; winProbabilityText: string; received?: Date | null; due?: Date | null },
  config: TenderConfig
): {
  winProbabilityNumeric: number;
  valueBand: string;
  year: number;
  quarter: string;
  tenderDurationDays: number | null;
} {
  const periodDate = input.received ?? new Date();
  return {
    winProbabilityNumeric: config.winProbWeights[input.winProbabilityText] ?? 0,
    valueBand: resolveValueBand(input.value, config.valueBands),
    year: periodDate.getFullYear(),
    quarter: quarterOf(periodDate),
    tenderDurationDays:
      input.received && input.due
        ? Math.round((input.due.getTime() - input.received.getTime()) / 86_400_000)
        : null,
  };
}
