import { assertInList, getConfig } from "@/lib/config";

export { assertInList };

export type DocumentConfig = {
  projectCategoryList: string[];
  tenderCategoryList: string[];
  linkedKindList: string[];
  generatedStatusList: string[];
};

/** Loads every Config-driven list the Documents panel depends on, resolved for this org. */
export async function loadDocumentConfig(organisationId: string): Promise<DocumentConfig> {
  const [projectCategoryList, tenderCategoryList, linkedKindList, generatedStatusList] = await Promise.all([
    getConfig<string[]>("document.projectCategoryList", organisationId),
    getConfig<string[]>("document.tenderCategoryList", organisationId),
    getConfig<string[]>("document.linkedKindList", organisationId),
    getConfig<string[]>("document.generatedStatusList", organisationId),
  ]);
  return { projectCategoryList, tenderCategoryList, linkedKindList, generatedStatusList };
}

/** A worker-attached document has no folder-template categories of its own — "General" always exists on both lists. */
export const GENERAL_CATEGORY = "General";
