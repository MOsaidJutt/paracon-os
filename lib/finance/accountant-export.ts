import { buildCsv } from "./csv";

export type AccountantExportRow = {
  type: "Bill" | "Progress Claim";
  date: Date | null;
  reference: string;
  project: string;
  party: string;
  amountExGst: number;
  status: string;
};

const HEADERS = ["Type", "Date", "Reference", "Project", "Supplier/Client", "Amount (ex GST)", "Status"];

/** A clean combined export of bills + claims + values for the accountant — not a Xero-specific format, just a plain audit-friendly CSV. */
export function buildAccountantExportCsv(rows: AccountantExportRow[]): string {
  return buildCsv(
    HEADERS,
    rows.map((row) => [
      row.type,
      row.date ? row.date.toISOString().slice(0, 10) : "",
      row.reference,
      row.project,
      row.party,
      row.amountExGst,
      row.status,
    ])
  );
}
