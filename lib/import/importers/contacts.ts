import { BadRequestError } from "@/lib/errors";
import { normalizeKey } from "@/lib/tenders/xlsx-parse";
import { contactsExtraSchema, type ContactsColumnMap } from "@/lib/validations/import";
import { readFirstSheet, toText } from "../xlsx-helpers";
import type { ImporterContext, Importer } from "../types";

export type ContactsPlanRow = {
  rowNumber: number;
  action: "create" | "update" | "skip";
  name: string | null;
  trade: string | null;
  status: string | null;
  address: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  comments: string | null;
  warnings: string[];
};

export type ContactsPlan =
  | { stage: "needs-mapping"; headers: string[]; sampleRows: Record<string, unknown>[] }
  | { stage: "ready"; contactType: "client" | "supplier"; rows: ContactsPlanRow[] };

/**
 * No fixed source format — a VA's export of a clients or suppliers list can
 * come from anywhere (Xero contacts export, a spreadsheet they maintain by
 * hand), so columns are user-mapped like ZZTakeoff rather than assumed. Name
 * matching mirrors the Tender Tracker importer's semantics (normalised,
 * case-insensitive) so the same "create vs update" rule applies everywhere a
 * client or supplier can be imported from. Pure (no DB access) so it's
 * directly unit-testable — callers precompute `existingKeys` from the DB
 * (normalizeKey(name) for clients, `company|contact` for suppliers).
 */
export function mapContactsRows(
  rows: Record<string, unknown>[],
  columnMap: ContactsColumnMap,
  contactType: "client" | "supplier",
  existingKeys: Set<string>
): ContactsPlanRow[] {
  return rows.map((row, index) => {
    const warnings: string[] = [];
    const name = toText(row[columnMap.name]);
    const trade = columnMap.trade ? toText(row[columnMap.trade]) : null;
    const contactName = columnMap.contactName ? toText(row[columnMap.contactName]) : null;

    if (!name) warnings.push("Missing name/company — row skipped.");
    if (contactType === "supplier" && !trade) warnings.push("Missing trade — row skipped.");

    const action: ContactsPlanRow["action"] =
      warnings.length > 0
        ? "skip"
        : contactType === "client"
          ? existingKeys.has(normalizeKey(name!))
            ? "update"
            : "create"
          : existingKeys.has(`${normalizeKey(name!)}|${normalizeKey(contactName ?? "")}`)
            ? "update"
            : "create";

    return {
      rowNumber: index + 2,
      action,
      name,
      trade,
      status: columnMap.status ? toText(row[columnMap.status]) : null,
      address: columnMap.address ? toText(row[columnMap.address]) : null,
      contactName,
      email: columnMap.email ? toText(row[columnMap.email]) : null,
      phone: columnMap.phone ? toText(row[columnMap.phone]) : null,
      mobile: columnMap.mobile ? toText(row[columnMap.mobile]) : null,
      comments: columnMap.comments ? toText(row[columnMap.comments]) : null,
      warnings,
    };
  });
}

async function loadExistingKeys(ctx: ImporterContext, contactType: "client" | "supplier"): Promise<Set<string>> {
  if (contactType === "client") {
    const clients = await ctx.db.client.findMany({ select: { name: true } });
    return new Set(clients.map((c) => normalizeKey(c.name)));
  }
  const suppliers = await ctx.db.supplier.findMany({ select: { company: true, contact: true } });
  return new Set(suppliers.map((s) => `${normalizeKey(s.company)}|${normalizeKey(s.contact ?? "")}`));
}

export const contactsImporter: Importer = {
  key: "contacts",
  label: "Contacts (Clients & Suppliers)",
  description:
    "A clients or suppliers/subcontractors list from anywhere (Xero export, a spreadsheet a VA maintains) — map columns once, matched by name against existing records.",
  acceptedExtensions: [".xlsx", ".xls", ".csv"],
  requiresExtra: true,

  async parsePreview(buffer, ctx, extra) {
    const parsedExtra = contactsExtraSchema.parse(extra ?? {});
    const { headers, rows } = readFirstSheet(buffer);
    if (headers.length === 0) throw new BadRequestError("Workbook has no sheets, or the first sheet is empty");

    if (!parsedExtra.columnMap || !parsedExtra.contactType) {
      return {
        plan: { stage: "needs-mapping", headers, sampleRows: rows.slice(0, 5) } satisfies ContactsPlan,
        summary: { totalRows: rows.length, stage: "needs-mapping" },
      };
    }
    if (parsedExtra.contactType === "supplier" && !parsedExtra.columnMap.trade) {
      throw new BadRequestError("Map a Trade column before previewing a suppliers import");
    }

    const existingKeys = await loadExistingKeys(ctx, parsedExtra.contactType);
    const planRows = mapContactsRows(rows, parsedExtra.columnMap, parsedExtra.contactType, existingKeys);
    return {
      plan: { stage: "ready", contactType: parsedExtra.contactType, rows: planRows } satisfies ContactsPlan,
      summary: {
        totalRows: planRows.length,
        create: planRows.filter((r) => r.action === "create").length,
        update: planRows.filter((r) => r.action === "update").length,
        skipped: planRows.filter((r) => r.action === "skip").length,
        stage: "ready",
      },
    };
  },

  async commit(buffer, ctx, extra) {
    const parsedExtra = contactsExtraSchema.parse(extra ?? {});
    if (!parsedExtra.columnMap || !parsedExtra.contactType) {
      throw new BadRequestError("A column map and contact type are required to commit a Contacts import");
    }

    const { rows } = readFirstSheet(buffer);
    const existingKeys = await loadExistingKeys(ctx, parsedExtra.contactType);
    const planRows = mapContactsRows(rows, parsedExtra.columnMap, parsedExtra.contactType, existingKeys);
    const toCommit = planRows.filter((r) => r.action !== "skip");

    let created = 0;
    let updated = 0;

    if (parsedExtra.contactType === "client") {
      for (const row of toCommit) {
        const client = await ctx.db.client.upsert({
          where: { organisationId_name: { organisationId: ctx.organisationId, name: row.name! } },
          create: { organisationId: ctx.organisationId, name: row.name!, address: row.address, status: row.status ?? "Pricing" },
          update: { address: row.address, status: row.status ?? undefined },
        });
        if (row.action === "create") created++;
        else updated++;

        if (row.contactName) {
          await ctx.db.clientContact.upsert({
            where: { clientId_name: { clientId: client.id, name: row.contactName } },
            create: { clientId: client.id, name: row.contactName, email: row.email, phone: row.phone, mobile: row.mobile },
            update: { email: row.email, phone: row.phone, mobile: row.mobile },
          });
        }
      }
    } else {
      for (const row of toCommit) {
        const existing = await ctx.db.supplier.findFirst({
          where: { organisationId: ctx.organisationId, company: row.name!, contact: row.contactName },
        });
        if (existing) {
          await ctx.db.supplier.update({
            where: { id: existing.id },
            data: { trade: row.trade!, email: row.email, phone: row.phone, comments: row.comments },
          });
          updated++;
        } else {
          await ctx.db.supplier.create({
            data: {
              organisationId: ctx.organisationId,
              trade: row.trade!,
              company: row.name!,
              contact: row.contactName,
              email: row.email,
              phone: row.phone,
              comments: row.comments,
              kind: parsedExtra.supplierKind ?? "Supplier",
            },
          });
          created++;
        }
      }
    }

    return { report: { created, updated, skipped: planRows.length - toCommit.length } };
  },
};
