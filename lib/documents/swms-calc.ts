import type { SwmsHazardLibraryItem } from "./templates-config";
import type { SwmsHazardLine } from "./types";

/** Merges the checked hazard-library items (by id) with any one-off custom lines, in that order — mirrors the Tender Letter's scope-line assembly. */
export function buildSwmsHazardLines(
  hazardLibrary: SwmsHazardLibraryItem[],
  hazardLibraryItemIds: string[],
  customHazardLines: SwmsHazardLine[]
): SwmsHazardLine[] {
  const checked = hazardLibrary
    .filter((item) => hazardLibraryItemIds.includes(item.id))
    .map((item) => ({ activity: item.activity, hazard: item.hazard, riskRating: item.riskRating, controlMeasures: item.controlMeasures }));
  return [...checked, ...customHazardLines];
}
