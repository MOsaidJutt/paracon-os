import * as XLSX from "xlsx";
import type { VariationSnapshot } from "../types";

/**
 * Mirrors Variation_Template_R2.xlsx's row layout (intake notes §5):
 * letterhead -> "Variation Quotation" + number -> date/attention/company/cc/from
 * -> project+address -> intro line -> Item|Description|$ rows -> Terms ->
 * TOTAL (ex GST) -> sign-off. Community-edition SheetJS has no cell
 * styling/fill support, so this mirrors structure + number formats, not the
 * source template's colours/fonts (the PDF carries the brand presentation).
 */
export function buildVariationWorkbook(snapshot: VariationSnapshot): Buffer {
  const rows: unknown[][] = [
    [`${snapshot.org.legalName}   ABN ${snapshot.org.abn}`],
    [snapshot.org.registeredAddress],
    [],
    ["", "Variation Quotation", "", "", snapshot.number],
    [],
    ["date", snapshot.date],
    ["attention", snapshot.attention],
    ["company", snapshot.company],
    ["cc", snapshot.cc],
    ["from", snapshot.from],
    [],
    ["project", snapshot.projectName],
    ["", snapshot.projectAddress],
    [],
    ["", snapshot.introLine],
    [],
    ["", "Item", "Description", "$"],
    ...snapshot.lineItems.map((line) => ["", line.item, line.description, "$", line.amount]),
    [],
    ["", "", "Terms:"],
    [
      "",
      "",
      `This variation is valid for ${snapshot.validityDays} days from the date of issue, after which we reserve the right to revise the pricing if any changes arise that affect the cost, scope or delivery of the works, including altered site conditions, increases in material/labour costs, delays, additional directions or any other relevant factors.`,
    ],
    [],
    ["", "", "TOTAL (ex GST)", "$", snapshot.totals.totalExGst],
    [],
    ["", "Should you have any queries, please feel free to contact the undersigned."],
    [],
    ["", "Regards,"],
    [],
    ["", snapshot.signOffName],
    ["", snapshot.signOffRole],
    ["", snapshot.signOffPhone],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 60 }, { wch: 6 }, { wch: 14 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Variation");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
