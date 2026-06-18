import * as XLSX from "xlsx";

export type TenderExportRow = {
  projectName: string;
  address: string | null;
  status: string;
  received: Date | null;
  due: Date | null;
  submitted: Date | null;
  value: number;
  clientName: string;
  contactName: string | null;
  winProbabilityText: string;
  winProbabilityNumeric: number;
  bidDecision: string;
  intent: string;
  reason: string | null;
  outcome: string | null;
  winningBid: number | null;
  winningCo: string | null;
  priceDeltaPct: number | null;
  valueBand: string;
  year: number;
  quarter: string;
  marginPct: number | null;
};

/** Builds an xlsx Buffer for the given (already-filtered) tenders, one sheet named "Tender Register". */
export function buildTenderExportWorkbook(rows: TenderExportRow[]): Buffer {
  const sheetRows = rows.map((row) => ({
    "Project Name": row.projectName,
    "Project Address": row.address ?? "",
    Status: row.status,
    Received: row.received ?? "",
    Due: row.due ?? "",
    Submitted: row.submitted ?? "",
    Value: row.value,
    Client: row.clientName,
    Contact: row.contactName ?? "",
    "Win Probability": row.winProbabilityText,
    "Win Prob (Numeric)": row.winProbabilityNumeric,
    "Bid Decision": row.bidDecision,
    Intent: row.intent,
    Reason: row.reason ?? "",
    Outcome: row.outcome ?? "",
    "Winning Bid": row.winningBid ?? "",
    "Winning Co.": row.winningCo ?? "",
    "Price Delta %": row.priceDeltaPct ?? "",
    "Value Band": row.valueBand,
    Year: row.year,
    Quarter: row.quarter,
    "Margin %": row.marginPct ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tender Register");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
