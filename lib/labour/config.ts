import { assertInList, getConfig } from "@/lib/config";

export { assertInList };

export type LabourConfig = {
  capabilityList: string[];
  employmentTypeList: string[];
  statusList: string[];
  complianceTypeList: string[];
  complianceExpiringThresholdDays: number;
};

/** Loads every Config-driven list/threshold the Labour Intelligence feature depends on, resolved for this org. */
export async function loadLabourConfig(organisationId: string): Promise<LabourConfig> {
  const [capabilityList, employmentTypeList, statusList, complianceTypeList, complianceExpiringThresholdDays] =
    await Promise.all([
      getConfig<string[]>("trade.capabilityList", organisationId),
      getConfig<string[]>("worker.employmentTypeList", organisationId),
      getConfig<string[]>("worker.statusList", organisationId),
      getConfig<string[]>("compliance.typeList", organisationId),
      getConfig<number>("compliance.expiringThresholdDays", organisationId),
    ]);
  return { capabilityList, employmentTypeList, statusList, complianceTypeList, complianceExpiringThresholdDays };
}
