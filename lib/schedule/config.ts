import { assertInList, getConfig } from "@/lib/config";

export { assertInList };

export type ScheduleConfig = {
  delayReasonList: string[];
  ganttAtRiskThresholdDays: number;
};

/** Loads every Config-driven list/threshold the Scheduling & Gantt module depends on, resolved for this org. */
export async function loadScheduleConfig(organisationId: string): Promise<ScheduleConfig> {
  const [delayReasonList, ganttAtRiskThresholdDays] = await Promise.all([
    getConfig<string[]>("schedule.delayReasonList", organisationId),
    getConfig<number>("schedule.ganttStatus.atRiskThresholdDays", organisationId),
  ]);
  return { delayReasonList, ganttAtRiskThresholdDays };
}
