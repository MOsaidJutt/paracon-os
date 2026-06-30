import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook } from "@/lib/tenders/xlsx-parse";

/**
 * Regression coverage for the demo-reported "Import Center workbook upload
 * threw an error" bug (FEEDBACK_NOTES.md §7.4). Investigation against the
 * real v9 - Tender Tracker.xlsx found no reproducible parser failure — but it
 * did surface a real structural quirk worth locking in: the real workbook's
 * "Tender Register new" sheet has ~1000 rows of Excel formatting/formula
 * residue below the ~30 real rows (some trailing rows have isolated `""`
 * cells from spilled formulas rather than being fully blank), and the real
 * client account uses several distinct Status values. This fixture
 * reproduces that exact shape with synthetic data — never the real file,
 * which holds real client/financial data with no business being committed to
 * a public test suite.
 */
function buildWorkbookWithTrailingFormulaJunk(): Buffer {
  const wb = XLSX.utils.book_new();

  const header = [
    "Project Name", "Project Address", "Status", "Addenda", "Received", "Due", "Submitted", "Value", "Client",
    "Contact", "Column 11", "Win Probability", "Consideration", "Bid Decision", "Black", "Intent", "Reason",
    "Status 2", "Black 2", "Outcome", "Winning Bid", "Winning Co.", "Price Delta %", "Win Prob (Numeric)",
    "Tender Duration (Days)", "Value Band", "Year", "Quarter", "Margin %",
  ];
  const realRows = [
    ["Project A", "1 Test St", "In Progress", null, "2026-01-01", "2026-01-15", null, 100000, "Client A", "Bob", null, "High", null, "Go", null, "Pursue", null, null, null, null, null, null, null, null, 14, null, "2026", "Q1", null],
    ["Project B", "2 Test St", "Submitted", null, "2026-02-01", "2026-02-15", "2026-02-10", 200000, "Client B", "Sue", null, "Likely", null, "Bid", null, "Pursue", null, null, null, null, null, null, null, null, 14, null, "2026", "Q1", null],
    ["Project C", "3 Test St", "Withdrawn", null, "2026-03-01", "2026-03-15", null, 50000, "Client A", "Bob", null, "Low", null, "No bid", null, "Decline", "Too risky", null, null, null, null, null, null, null, 14, null, "2026", "Q1", null],
  ];
  // Excel-formula-residue rows: every cell null except a handful of formula
  // result columns evaluating to "" — exactly what the real workbook has
  // below its last real row, all the way to row ~1000.
  const junkRow = header.map(() => null);
  junkRow[23] = "";
  junkRow[25] = "";
  junkRow[26] = "";
  junkRow[27] = "";
  const trailingJunkRows = Array.from({ length: 50 }, () => junkRow);

  const tenderSheet = XLSX.utils.aoa_to_sheet([header, ...realRows, ...trailingJunkRows]);
  XLSX.utils.book_append_sheet(wb, tenderSheet, "Tender Register new");

  // Client Directory / Supplier Directory carry a blank title row above the
  // header in the real workbook — reproduced here, plus the same trailing
  // formula-residue pattern.
  const clientHeader = ["Status", "Client", "Address", "Contact", "Email", "Phone", "Mobile"];
  const clientRows = [
    ["Active", "Client A", "1 Test St", "Bob", "bob@example.com", "0400000000", null],
    ["Active", "Client B", "2 Test St", "Sue", "sue@example.com", "0400000001", null],
  ];
  const clientJunkRow = clientHeader.map(() => null);
  clientJunkRow[6] = "";
  const clientSheet = XLSX.utils.aoa_to_sheet([
    [null],
    clientHeader,
    ...clientRows,
    ...Array.from({ length: 20 }, () => clientJunkRow),
  ]);
  XLSX.utils.book_append_sheet(wb, clientSheet, "Client Directory");

  const supplierHeader = ["Trades", "Company", "Contact", "Position", "Email", "Phone", "Comments"];
  const supplierRows = [["Partitions", "Supplier A", "John", "Manager", "john@example.com", "0400000002", null]];
  const supplierSheet = XLSX.utils.aoa_to_sheet([[null], supplierHeader, ...supplierRows]);
  XLSX.utils.book_append_sheet(wb, supplierSheet, "Supplier Directory");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseWorkbook against a v9-shaped workbook (trailing formula-residue rows)", () => {
  it("returns only the real data rows, never the ~1000-row formula-residue tail", () => {
    const parsed = parseWorkbook(buildWorkbookWithTrailingFormulaJunk());

    expect(parsed.tenders).toHaveLength(3);
    expect(parsed.clientDirectory).toHaveLength(2);
    expect(parsed.suppliers).toHaveLength(1);
  });

  it("preserves every distinct Status value seen in the real workbook", () => {
    const parsed = parseWorkbook(buildWorkbookWithTrailingFormulaJunk());
    const statuses = new Set(parsed.tenders.map((t) => t.status));
    expect(statuses).toEqual(new Set(["In Progress", "Submitted", "Withdrawn"]));
  });

  it("tolerates the blank title row above Client/Supplier Directory headers", () => {
    const parsed = parseWorkbook(buildWorkbookWithTrailingFormulaJunk());
    expect(parsed.clientDirectory.map((c) => c.client)).toEqual(["Client A", "Client B"]);
    expect(parsed.suppliers.map((s) => s.company)).toEqual(["Supplier A"]);
  });
});
