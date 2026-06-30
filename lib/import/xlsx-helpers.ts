import * as XLSXLib from "xlsx";

/**
 * Reads the first sheet of a workbook into headers + row objects, scanning
 * for the first non-empty row as the header (tolerates a blank title row
 * above it) rather than assuming row 1 — shared by every importer that
 * doesn't assume a fixed sheet shape (ZZTakeoff, Contacts).
 */
export function readFirstSheet(buffer: Buffer): { headers: string[]; rows: Record<string, unknown>[] } {
  const workbook = XLSXLib.read(buffer, { type: "buffer", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[firstSheetName];

  const rawRows = XLSXLib.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
  const headerIndex = rawRows.findIndex((row) => row.some((cell) => cell !== null && cell !== ""));
  if (headerIndex === -1) return { headers: [], rows: [] };

  const headers = rawRows[headerIndex].map((cell) => (cell === null ? "" : String(cell).trim())).filter(Boolean);
  const rows = rawRows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell !== null && cell !== ""))
    .map((row) => {
      const obj: Record<string, unknown> = {};
      rawRows[headerIndex].forEach((key, i) => {
        if (key !== null && key !== "") obj[String(key).trim()] = row[i] ?? null;
      });
      return obj;
    });

  return { headers, rows };
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}
