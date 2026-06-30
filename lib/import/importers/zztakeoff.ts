import { BadRequestError } from "@/lib/errors";
import { zztakeoffExtraSchema, type ZztakeoffColumnMap } from "@/lib/validations/import";
import { readFirstSheet, toNumber, toText } from "../xlsx-helpers";
import type { Importer } from "../types";

/**
 * We don't have a real ZZTakeoff export sample (intake notes only inspected
 * the Breakdown sheet's Quantity|UoM|Unit rate|Amount|Remarks shape), so
 * headers aren't hard-coded — the user picks a target Project/Tender and
 * maps spreadsheet columns to our fields before committing.
 */
export type ZztakeoffPlanRow = {
  rowNumber: number;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  unitRate: number | null;
  amount: number | null;
  remarks: string | null;
  warnings: string[];
};

export type ZztakeoffPlan =
  | { stage: "needs-mapping"; headers: string[]; sampleRows: Record<string, unknown>[] }
  | { stage: "ready"; rows: ZztakeoffPlanRow[] };

export function mapRows(rows: Record<string, unknown>[], columnMap: ZztakeoffColumnMap): ZztakeoffPlanRow[] {
  return rows.map((row, index) => {
    const warnings: string[] = [];
    const description = toText(row[columnMap.description]);
    const quantity = toNumber(row[columnMap.quantity]);
    const unit = toText(row[columnMap.unit]);

    if (!description) warnings.push("Missing description.");
    if (quantity === null) warnings.push("Missing or non-numeric quantity.");
    if (!unit) warnings.push("Missing unit of measure.");

    return {
      rowNumber: index + 2,
      description,
      quantity,
      unit,
      unitRate: columnMap.unitRate ? toNumber(row[columnMap.unitRate]) : null,
      amount: columnMap.amount ? toNumber(row[columnMap.amount]) : null,
      remarks: columnMap.remarks ? toText(row[columnMap.remarks]) : null,
      warnings,
    };
  });
}

export const zztakeoffImporter: Importer = {
  key: "zztakeoff",
  label: "ZZTakeoff quantity export",
  description: "Excel/CSV take-off export (Quantity / UoM / Unit rate / Amount / Remarks) mapped into estimate line items for one project or tender.",
  acceptedExtensions: [".xlsx", ".xls", ".csv"],
  requiresExtra: true,

  async parsePreview(buffer, _ctx, extra) {
    const parsedExtra = zztakeoffExtraSchema.parse(extra ?? {});
    const { headers, rows } = readFirstSheet(buffer);
    if (headers.length === 0) throw new BadRequestError("Workbook has no sheets, or the first sheet is empty");

    if (!parsedExtra.columnMap) {
      return {
        plan: { stage: "needs-mapping", headers, sampleRows: rows.slice(0, 5) } satisfies ZztakeoffPlan,
        summary: { totalRows: rows.length, stage: "needs-mapping" },
      };
    }

    const mapped = mapRows(rows, parsedExtra.columnMap);
    return {
      plan: { stage: "ready", rows: mapped } satisfies ZztakeoffPlan,
      summary: {
        totalRows: mapped.length,
        withWarnings: mapped.filter((r) => r.warnings.length > 0).length,
        stage: "ready",
      },
    };
  },

  async commit(buffer, ctx, extra) {
    const parsedExtra = zztakeoffExtraSchema.parse(extra ?? {});
    if (!parsedExtra.columnMap) throw new BadRequestError("A column map is required to commit a ZZTakeoff import");
    if (!parsedExtra.targetProjectId && !parsedExtra.targetTenderId) {
      throw new BadRequestError("A target project or tender is required to commit a ZZTakeoff import");
    }

    if (parsedExtra.targetProjectId) {
      const project = await ctx.db.project.findFirst({ where: { id: parsedExtra.targetProjectId } });
      if (!project) throw new BadRequestError("Target project not found");
    }
    if (parsedExtra.targetTenderId) {
      const tender = await ctx.db.tender.findFirst({ where: { id: parsedExtra.targetTenderId } });
      if (!tender) throw new BadRequestError("Target tender not found");
    }

    const { rows } = readFirstSheet(buffer);
    const mapped = mapRows(rows, parsedExtra.columnMap);
    const validRows = mapped.filter((r) => r.description && r.quantity !== null && r.unit);

    const created = await ctx.db.$transaction(
      validRows.map((row) =>
        ctx.db.estimateLineItem.create({
          data: {
            organisationId: ctx.organisationId,
            description: row.description!,
            quantity: row.quantity!,
            unit: row.unit!,
            unitRate: row.unitRate,
            amount: row.amount,
            remarks: row.remarks,
            projectId: parsedExtra.targetProjectId ?? null,
            tenderId: parsedExtra.targetTenderId ?? null,
            source: "zztakeoff",
            importJobId: ctx.importJobId,
          },
        })
      )
    );

    return {
      report: { created: created.length, skipped: mapped.length - validRows.length },
    };
  },
};
