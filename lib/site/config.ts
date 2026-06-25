import { assertInList, getConfig } from "@/lib/config";

export { assertInList };

export type SiteConfig = {
  issueSeverityList: string[];
  issueStatusList: string[];
  photoTagList: string[];
  // Task progress chips reuse the construction program's own status list
  // (lib/projects/config.ts) rather than a second vocabulary, since ticking a
  // task in the mobile flow writes straight through to ProgramActivity.status.
  activityStatusList: string[];
};

/** Loads every Config-driven list the Foreman Mobile Daily Update feature depends on, resolved for this org. */
export async function loadSiteConfig(organisationId: string): Promise<SiteConfig> {
  const [issueSeverityList, issueStatusList, photoTagList, activityStatusList] = await Promise.all([
    getConfig<string[]>("site.issueSeverityList", organisationId),
    getConfig<string[]>("site.issueStatusList", organisationId),
    getConfig<string[]>("site.photoTagList", organisationId),
    getConfig<string[]>("activity.statusList", organisationId),
  ]);
  return { issueSeverityList, issueStatusList, photoTagList, activityStatusList };
}
