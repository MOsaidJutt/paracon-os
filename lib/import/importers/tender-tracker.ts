import { loadTenderConfig } from "@/lib/tenders/config";
import { buildImportPlan, commitImportPlan } from "@/lib/tenders/import";
import type { Importer } from "../types";

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
