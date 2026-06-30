import * as XLSXLib from "xlsx";
import { loadTenderConfig } from "@/lib/tenders/config";
import { buildImportPlan, commitImportPlan } from "@/lib/tenders/import";
import type { Importer } from "../types";

/**
 * A synthetic (never real-data) sample matching exactly the columns
 * xlsx-parse.ts actually reads — the "expected file structure" reference the
 * Import Centre wizard offers before upload, answering the demo's "the exact
 * required field/format structure isn't documented" complaint directly.
 * Never serves the real `v9 - Tender Tracker.xlsx` (it holds real client/
 * financial data and has no business being a public download).
 */
export function buildSampleWorkbook(): Buffer {
  const workbook = XLSXLib.utils.book_new();

  const tenders = XLSXLib.utils.aoa_to_sheet([
    [
      "Project Name", "Project Address", "Status", "Received", "Due", "Submitted", "Value", "Client", "Contact",
      "Win Probability", "Bid Decision", "Intent", "Reason", "Outcome", "Winning Bid", "Winning Co.", "Price Delta %", "Margin %",
    ],
    [
      "Example Fitout — L5 123 Example St", "123 Example St, Melbourne", "In Progress", "2026-01-05", "2026-01-20", null, 250000,
      "Example Client Pty Ltd", "Jane Smith", "Likely", "Bid", "Pursue", null, null, null, null, null, null,
    ],
  ]);
  XLSXLib.utils.book_append_sheet(workbook, tenders, "Tender Register new");

  const clients = XLSXLib.utils.aoa_to_sheet([
    ["Status", "Client", "Address", "Contact", "Email", "Phone", "Mobile"],
    ["Active", "Example Client Pty Ltd", "1 Example St, Melbourne", "Jane Smith", "jane@example.com", "03 9000 0000", "0400 000 000"],
  ]);
  XLSXLib.utils.book_append_sheet(workbook, clients, "Client Directory");

  const suppliers = XLSXLib.utils.aoa_to_sheet([
    ["Trades", "Company", "Contact", "Position", "Email", "Phone", "Comments"],
    ["Partitions", "Example Partitions Pty Ltd", "John Doe", "Director", "john@example.com", "03 9000 1111", null],
  ]);
  XLSXLib.utils.book_append_sheet(workbook, suppliers, "Supplier Directory");

  return XLSXLib.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Thin adapter around the existing Tender Pipeline importer (Phase 3/4) so it
 * also shows up as a pluggable importer in the unified Import Centre under
 * `import.run`, without touching its working buildImportPlan/commitImportPlan
 * logic or the already-shipped /tenders/import flow.
 */
export const tenderTrackerImporter: Importer = {
  key: "tender-tracker",
  label: "Tender Tracker workbook",
  description:
    "Tender Register new, Client Directory and Supplier Directory sheets from the v9 Tender Tracker.xlsx.",
  acceptedExtensions: [".xlsx"],
  requiresExtra: false,

  async parsePreview(buffer, ctx) {
    const config = await loadTenderConfig(ctx.organisationId);
    const plan = await buildImportPlan(buffer, ctx.db, config);
    const summary = {
      clients: {
        create: plan.clients.filter((c) => c.action === "create").length,
        update: plan.clients.filter((c) => c.action === "update").length,
      },
      suppliers: {
        create: plan.suppliers.filter((s) => s.action === "create").length,
        update: plan.suppliers.filter((s) => s.action === "update").length,
      },
      tenders: {
        create: plan.tenders.filter((t) => t.action === "create").length,
        update: plan.tenders.filter((t) => t.action === "update").length,
        skip: plan.tenders.filter((t) => t.action === "skip").length,
      },
      configWarnings: plan.configWarnings,
    };
    return { plan, summary };
  },

  async commit(buffer, ctx) {
    const config = await loadTenderConfig(ctx.organisationId);
    const plan = await buildImportPlan(buffer, ctx.db, config);
    const report = await commitImportPlan(plan, ctx.db, ctx.organisationId, config);
    return { report };
  },
};
