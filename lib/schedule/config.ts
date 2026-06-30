import { assertInList, getConfig } from "@/lib/config";

export { assertInList };

export type ScheduleConfig = {
  delayReasonList: string[];
};

/** Loads every Config-driven list the Scheduling & Gantt module depends on, resolved for this org. */
export async function loadScheduleConfig(organisationId: string): Promise<ScheduleConfig> {
  const delayReasonList = await getConfig<string[]>("schedule.delayReasonList", organisationId);
  return { delayReasonList };
}
