import { assertInList, getConfig } from "@/lib/config";

export { assertInList };

export type ProspectConfig = {
  stageList: string[];
};

/** Loads the Config-driven stage list (cold/warm) the prospects register depends on, resolved for this org. */
export async function loadProspectConfig(organisationId: string): Promise<ProspectConfig> {
  const stageList = await getConfig<string[]>("prospect.stageList", organisationId);
  return { stageList };
}
