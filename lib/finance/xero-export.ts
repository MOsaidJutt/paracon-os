import { buildCsv } from "./csv";

export type XeroBillExportRow = {
  supplierName: string;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  description: string;
  amountExGst: number;
};

const HEADERS = ["ContactName", "InvoiceNumber", "InvoiceDate", "Description", "Quantity", "UnitAmount", "AccountCode", "TaxType", "Currency"];

/**
 * Builds a Xero bills-import-shaped CSV (the standard Accounts Payable bulk
 * import column set) for an accounts person to bring Approved bills into
 * Xero by hand — there is no live Xero API call. AccountCode/TaxType are
 * left blank deliberately: those are chart-of-accounts/tax-rate choices only
 * the accounts team's own Xero org can answer correctly.
 */
export function buildXeroBillsCsv(rows: XeroBillExportRow[]): string {
  return buildCsv(
    HEADERS,
    rows.map((row) => [
      row.supplierName,
      row.invoiceNumber ?? "",
      row.invoiceDate ? row.invoiceDate.toISOString().slice(0, 10) : "",
      row.description,
      1,
      row.amountExGst,
      "",
      "",
      "AUD",
    ])
  );
}
