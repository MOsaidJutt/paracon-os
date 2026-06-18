import * as XLSX from "xlsx";

export function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function dateVal(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Converts a worksheet into row objects keyed by its header row, tolerating
 * a blank title row above the header (the "Client Directory" and "Supplier
 * Directory" sheets in the client's xlsx both have one) by scanning for the
 * first non-empty row instead of assuming row 1 is the header.
 */
function sheetToObjects(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
  const headerIndex = rows.findIndex((row) => row.some((cell) => cell !== null && cell !== ""));
  if (headerIndex === -1) return [];

  const header = rows[headerIndex].map((cell) => (cell === null ? "" : String(cell).trim()));
  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell !== null && cell !== ""))
    .map((row) => {
      const obj: Record<string, unknown> = {};
      header.forEach((key, i) => {
        if (key) obj[key] = row[i] ?? null;
      });
      return obj;
    });
}

export type RawTenderRow = {
  projectName: string | null;
  address: string | null;
  status: string | null;
  received: Date | null;
  due: Date | null;
  submitted: Date | null;
  value: number | null;
  client: string | null;
  contact: string | null;
  winProbabilityText: string | null;
  bidDecision: string | null;
  intent: string | null;
  reason: string | null;
  outcome: string | null;
  winningBid: number | null;
  winningCo: string | null;
  priceDeltaPct: number | null;
  marginPct: number | null;
};

export type RawClientDirectoryRow = {
  status: string | null;
  client: string | null;
  address: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
};

export type RawSupplierRow = {
  trade: string | null;
  company: string | null;
  contact: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  comments: string | null;
};

export type ConfigSheetSnapshot = {
  statusWeights: Record<string, number>;
  valueBands: { label: string; max: number | null }[];
};

export type ParsedWorkbook = {
  tenders: RawTenderRow[];
  clientDirectory: RawClientDirectoryRow[];
  suppliers: RawSupplierRow[];
  configSnapshot: ConfigSheetSnapshot | null;
};

const SHEET_NAMES = {
  tenders: "Tender Register new",
  clients: "Client Directory",
  suppliers: "Supplier Directory",
  config: "Config",
};

/**
 * Best-effort read of the workbook's hidden Config sheet (StatusList /
 * "Win Probability Default" pairs + the "VALUE BAND THRESHOLDS" block) so the
 * import preview can flag drift against our own Config registry. The Config
 * registry in the database stays authoritative either way — this never
 * writes anything, and any parsing failure just means we skip the check.
 */
function parseConfigSheet(workbook: XLSX.WorkBook): ConfigSheetSnapshot | null {
  const sheet = workbook.Sheets[SHEET_NAMES.config];
  if (!sheet) return null;

  try {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
    const statusWeights: Record<string, number> = {};
    for (let i = 1; i < rows.length; i++) {
      const [label, weight] = rows[i];
      if (typeof label !== "string" || typeof weight !== "number") break;
      statusWeights[label.trim()] = weight;
    }

    const thresholdRowIndex = rows.findIndex(
      (row) => typeof row[0] === "string" && row[0].trim().toUpperCase() === "VALUE BAND THRESHOLDS"
    );
    const valueBands: { label: string; max: number | null }[] = [];
    if (thresholdRowIndex !== -1) {
      for (let i = thresholdRowIndex + 2; i < rows.length; i++) {
        const [label, max] = rows[i];
        if (typeof label !== "string") break;
        valueBands.push({ label: label.trim(), max: typeof max === "number" ? max : null });
      }
    }

    return { statusWeights, valueBands };
  } catch {
    return null;
  }
}

export function parseWorkbook(buffer: Buffer): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const requiredSheets = [SHEET_NAMES.tenders, SHEET_NAMES.clients, SHEET_NAMES.suppliers];
  const missing = requiredSheets.filter((name) => !workbook.Sheets[name]);
  if (missing.length > 0) {
    throw new Error(`Workbook is missing required sheet(s): ${missing.join(", ")}`);
  }

  const tenderRows = sheetToObjects(workbook.Sheets[SHEET_NAMES.tenders]);
  const clientRows = sheetToObjects(workbook.Sheets[SHEET_NAMES.clients]);
  const supplierRows = sheetToObjects(workbook.Sheets[SHEET_NAMES.suppliers]);

  return {
    tenders: tenderRows.map((r) => ({
      projectName: str(r["Project Name"]),
      address: str(r["Project Address"]),
      status: str(r["Status"]),
      received: dateVal(r["Received"]),
      due: dateVal(r["Due"]),
      submitted: dateVal(r["Submitted"]),
      value: num(r["Value"]),
      client: str(r["Client"]),
      contact: str(r["Contact"]),
      winProbabilityText: str(r["Win Probability"]),
      bidDecision: str(r["Bid Decision"]),
      intent: str(r["Intent"]),
      reason: str(r["Reason"]),
      outcome: str(r["Outcome"]),
      winningBid: num(r["Winning Bid"]),
      winningCo: str(r["Winning Co."]),
      priceDeltaPct: num(r["Price Delta %"]),
      marginPct: num(r["Margin %"]),
    })),
    clientDirectory: clientRows.map((r) => ({
      status: str(r["Status"]),
      client: str(r["Client"]),
      address: str(r["Address"]),
      contact: str(r["Contact"]),
      email: str(r["Email"]),
      phone: str(r["Phone"]),
      mobile: str(r["Mobile"]),
    })),
    suppliers: supplierRows.map((r) => ({
      trade: str(r["Trades"]),
      company: str(r["Company"]),
      contact: str(r["Contact"]),
      position: str(r["Position"]),
      email: str(r["Email"]),
      phone: str(r["Phone"]),
      comments: str(r["Comments"]),
    })),
    configSnapshot: parseConfigSheet(workbook),
  };
}
