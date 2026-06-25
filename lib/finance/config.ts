import { assertInList, getConfig } from "@/lib/config";

export { assertInList };

export type FinanceConfig = {
  poStatusList: string[];
  deliveryStatusList: string[];
  billStatusList: string[];
  billAllocationStatusList: string[];
  variationStatusList: string[];
  progressClaimStatusList: string[];
  retentionReleaseTypeList: string[];
  retentionRatePct: number;
  retentionCapPct: number;
  retentionPcReleaseFractionPct: number;
  reconcileTolerancePct: number;
  poNumberPrefix: string;
  poNumberPadding: number;
  poOpenStatusesForBillMatch: string[];
};

/** Loads every Config-driven value the Project Financials & Invoice Review feature depends on, resolved for this org. */
export async function loadFinanceConfig(organisationId: string): Promise<FinanceConfig> {
  const [
    poStatusList,
    deliveryStatusList,
    billStatusList,
    billAllocationStatusList,
    variationStatusList,
    progressClaimStatusList,
    retentionReleaseTypeList,
    retentionRatePct,
    retentionCapPct,
    retentionPcReleaseFractionPct,
    reconcileTolerancePct,
    poNumberPrefix,
    poNumberPadding,
    poOpenStatusesForBillMatch,
  ] = await Promise.all([
    getConfig<string[]>("finance.po.statusList", organisationId),
    getConfig<string[]>("finance.delivery.statusList", organisationId),
    getConfig<string[]>("finance.bill.statusList", organisationId),
    getConfig<string[]>("finance.bill.allocationStatusList", organisationId),
    getConfig<string[]>("finance.variation.statusList", organisationId),
    getConfig<string[]>("finance.progressClaim.statusList", organisationId),
    getConfig<string[]>("finance.retentionReleaseTypeList", organisationId),
    getConfig<number>("finance.retention.ratePct", organisationId),
    getConfig<number>("finance.retention.capPct", organisationId),
    getConfig<number>("finance.retention.pcReleaseFractionPct", organisationId),
    getConfig<number>("finance.reconcile.tolerancePct", organisationId),
    getConfig<string>("finance.po.numberPrefix", organisationId),
    getConfig<number>("finance.po.numberPadding", organisationId),
    getConfig<string[]>("finance.po.openStatusesForBillMatch", organisationId),
  ]);

  return {
    poStatusList,
    deliveryStatusList,
    billStatusList,
    billAllocationStatusList,
    variationStatusList,
    progressClaimStatusList,
    retentionReleaseTypeList,
    retentionRatePct,
    retentionCapPct,
    retentionPcReleaseFractionPct,
    reconcileTolerancePct,
    poNumberPrefix,
    poNumberPadding,
    poOpenStatusesForBillMatch,
  };
}
