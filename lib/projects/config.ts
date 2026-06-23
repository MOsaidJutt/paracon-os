import { assertInList, getConfig } from "@/lib/config";

export { assertInList };

export type ProjectConfig = {
  statusList: string[];
  activityStatusList: string[];
  milestoneTypeList: string[];
  tradeList: string[];
};

/** Loads every Config-driven list the Projects & Program feature depends on, resolved for this org. */
export async function loadProjectConfig(organisationId: string): Promise<ProjectConfig> {
  const [statusList, activityStatusList, milestoneTypeList, tradeList] = await Promise.all([
    getConfig<string[]>("project.statusList", organisationId),
    getConfig<string[]>("activity.statusList", organisationId),
    getConfig<string[]>("milestone.typeList", organisationId),
    getConfig<string[]>("trade.capabilityList", organisationId),
  ]);
  return { statusList, activityStatusList, milestoneTypeList, tradeList };
}
