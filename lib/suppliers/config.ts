import { assertInList, getConfig } from "@/lib/config";

export { assertInList };

export type SupplierConfig = {
  kindList: string[];
};

/** Loads the Config-driven kind list (Supplier/Subcontractor) the suppliers directory depends on, resolved for this org. */
export async function loadSupplierConfig(organisationId: string): Promise<SupplierConfig> {
  const kindList = await getConfig<string[]>("supplier.kindList", organisationId);
  return { kindList };
}
