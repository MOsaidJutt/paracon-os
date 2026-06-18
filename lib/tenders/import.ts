import type { TenantContext } from "@/lib/tenant";
import { normalizeKey, parseWorkbook, type RawClientDirectoryRow } from "./xlsx-parse";
import { deriveTenderComputedFields, type TenderConfig } from "./config";

type Action = "create" | "update";
type TenderAction = Action | "skip";

export type ClientContactPlanRow = {
  action: Action;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
};

export type ClientPlanRow = {
  action: Action;
  key: string;
  name: string;
  address: string | null;
  status: string;
  contacts: ClientContactPlanRow[];
  warnings: string[];
};

export type SupplierPlanRow = {
  action: Action;
  key: string;
  trade: string;
  company: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  comments: string | null;
  warnings: string[];
};

export type TenderPlanRow = {
  action: TenderAction;
  rowNumber: number;
  projectName: string;
  clientKey: string;
  clientName: string;
  contactName: string | null;
  address: string | null;
  status: string;
  received: Date | null;
  due: Date | null;
  submitted: Date | null;
  value: number;
  winProbabilityText: string;
  bidDecision: string;
  intent: string;
  reason: string | null;
  outcome: string | null;
  winningBid: number | null;
  winningCo: string | null;
  priceDeltaPct: number | null;
  marginPct: number | null;
  warnings: string[];
};

export type ImportPlan = {
  clients: ClientPlanRow[];
  suppliers: SupplierPlanRow[];
  tenders: TenderPlanRow[];
  configWarnings: string[];
};

export type ImportReport = {
  clients: { created: number; updated: number };
  suppliers: { created: number; updated: number };
  tenders: { created: number; updated: number; skipped: number };
};

function bump(counter: { created: number; updated: number }, action: Action): void {
  if (action === "create") counter.created++;
  else counter.updated++;
}

function groupClientDirectoryRows(rows: RawClientDirectoryRow[]) {
  const byKey = new Map<string, { name: string; address: string | null; status: string | null; contacts: Map<string, RawClientDirectoryRow> }>();

  for (const row of rows) {
    if (!row.client) continue;
    const key = normalizeKey(row.client);
    if (!byKey.has(key)) {
      byKey.set(key, { name: row.client, address: row.address, status: row.status, contacts: new Map() });
    }
    const group = byKey.get(key)!;
    if (row.contact) group.contacts.set(normalizeKey(row.contact), row);
  }

  return byKey;
}

function compareConfigSnapshot(
  snapshot: { statusWeights: Record<string, number>; valueBands: { label: string; max: number | null }[] } | null,
  config: TenderConfig
): string[] {
  if (!snapshot) return [];
  const warnings: string[] = [];

  for (const [status, weight] of Object.entries(snapshot.statusWeights)) {
    const ours = config.statusWeights[status];
    if (ours === undefined) {
      warnings.push(`Workbook Config sheet has status "${status}" with no matching tender.statusWeights entry.`);
    } else if (Math.abs(ours - weight) > 0.001) {
      warnings.push(`Workbook Config sheet weights "${status}" as ${weight}, but tender.statusWeights has ${ours}.`);
    }
  }

  const oursBands = config.valueBands.map((b) => `${b.label}:${b.max ?? "open"}`).join(", ");
  const theirsBands = snapshot.valueBands.map((b) => `${b.label}:${b.max && b.max < 1e8 ? b.max : "open"}`).join(", ");
  if (oursBands !== theirsBands) {
    warnings.push(`Workbook value-band thresholds (${theirsBands}) differ from tender.valueBands (${oursBands}).`);
  }

  return warnings;
}

/**
 * Parses the workbook and classifies every row as create/update/skip against
 * this org's existing data, without writing anything. Tenders reference
 * their client by a normalized-name key rather than a real id, because a
 * referenced client may itself be a pending "create" in this same plan —
 * commitImportPlan resolves those keys to real ids after the client pass.
 */
export async function buildImportPlan(buffer: Buffer, db: TenantContext, config: TenderConfig): Promise<ImportPlan> {
  const parsed = parseWorkbook(buffer);

  const existingClients = await db.client.findMany({ include: { contacts: true } });
  const existingClientByKey = new Map(existingClients.map((c) => [normalizeKey(c.name), c]));

  const existingSuppliers = await db.supplier.findMany();
  const existingSupplierByKey = new Map(
    existingSuppliers.map((s) => [`${normalizeKey(s.company)}|${normalizeKey(s.contact ?? "")}`, s])
  );

  const existingTenders = await db.tender.findMany({ include: { client: true } });
  const existingTenderByKey = new Map(
    existingTenders.map((t) => [`${normalizeKey(t.projectName)}|${normalizeKey(t.client.name)}`, t])
  );

  // ── Clients ──────────────────────────────────────────────────────────────
  const clientGroups = groupClientDirectoryRows(parsed.clientDirectory);
  const clients: ClientPlanRow[] = [];
  const clientKeysSeen = new Set<string>();

  for (const [key, group] of clientGroups) {
    const existing = existingClientByKey.get(key);
    const warnings: string[] = [];
    const status = group.status ?? "Pricing";
    if (!config.clientStatusList.includes(status)) {
      warnings.push(`Status "${status}" is not in client.statusList; saved as-is.`);
    }

    const existingContactByKey = new Map((existing?.contacts ?? []).map((c) => [normalizeKey(c.name), c]));
    const contacts: ClientContactPlanRow[] = Array.from(group.contacts.values()).map((row) => ({
      action: existingContactByKey.has(normalizeKey(row.contact!)) ? "update" : "create",
      name: row.contact!,
      position: null,
      email: row.email,
      phone: row.phone,
      mobile: row.mobile,
    }));

    clients.push({
      action: existing ? "update" : "create",
      key,
      name: group.name,
      address: group.address,
      status,
      contacts,
      warnings,
    });
    clientKeysSeen.add(key);
  }

  // ── Suppliers ────────────────────────────────────────────────────────────
  const suppliers: SupplierPlanRow[] = parsed.suppliers
    .filter((row) => row.company && row.trade)
    .map((row) => {
      const key = `${normalizeKey(row.company!)}|${normalizeKey(row.contact ?? "")}`;
      const comments = [row.position, row.comments].filter(Boolean).join(" — ") || null;
      return {
        action: existingSupplierByKey.has(key) ? "update" : "create",
        key,
        trade: row.trade!,
        company: row.company!,
        contact: row.contact,
        email: row.email,
        phone: row.phone,
        comments,
        warnings: [],
      };
    });

  // ── Tenders ──────────────────────────────────────────────────────────────
  const tenders: TenderPlanRow[] = [];
  parsed.tenders.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for 1-based, +1 for the header row
    const warnings: string[] = [];

    if (!row.projectName || !row.client) {
      tenders.push({
        action: "skip",
        rowNumber,
        projectName: row.projectName ?? "(blank)",
        clientKey: "",
        clientName: row.client ?? "(blank)",
        contactName: row.contact,
        address: row.address,
        status: row.status ?? "",
        received: row.received,
        due: row.due,
        submitted: row.submitted,
        value: row.value ?? 0,
        winProbabilityText: row.winProbabilityText ?? "",
        bidDecision: row.bidDecision ?? "",
        intent: row.intent ?? "",
        reason: row.reason,
        outcome: row.outcome,
        winningBid: row.winningBid,
        winningCo: row.winningCo,
        priceDeltaPct: row.priceDeltaPct,
        marginPct: row.marginPct,
        warnings: ["Missing required field (Project Name or Client) — row skipped."],
      });
      return;
    }

    const clientKey = normalizeKey(row.client);
    if (!clientKeysSeen.has(clientKey) && !existingClientByKey.has(clientKey)) {
      // Tender references a client absent from the Client Directory sheet and
      // not already on file — auto-create a minimal stub so the tender can
      // still be linked, rather than dropping the row.
      clients.push({
        action: "create",
        key: clientKey,
        name: row.client,
        address: null,
        status: "Pricing",
        contacts: [],
        warnings: [],
      });
      clientKeysSeen.add(clientKey);
      warnings.push(`Client "${row.client}" was not in the Client Directory — created automatically.`);
    }

    if (!row.status || !config.statusList.includes(row.status)) {
      tenders.push({
        action: "skip",
        rowNumber,
        projectName: row.projectName,
        clientKey,
        clientName: row.client,
        contactName: row.contact,
        address: row.address,
        status: row.status ?? "",
        received: row.received,
        due: row.due,
        submitted: row.submitted,
        value: row.value ?? 0,
        winProbabilityText: row.winProbabilityText ?? "",
        bidDecision: row.bidDecision ?? "",
        intent: row.intent ?? "",
        reason: row.reason,
        outcome: row.outcome,
        winningBid: row.winningBid,
        winningCo: row.winningCo,
        priceDeltaPct: row.priceDeltaPct,
        marginPct: row.marginPct,
        warnings: [`Status "${row.status ?? ""}" is not in tender.statusList — row skipped.`],
      });
      return;
    }

    const winProbabilityText = row.winProbabilityText ?? "";
    if (!(winProbabilityText in config.winProbWeights)) {
      warnings.push(`Win Probability "${winProbabilityText}" is not in tender.winProbWeights — defaulted to 0.`);
    }
    if (row.bidDecision && !config.bidDecisionList.includes(row.bidDecision)) {
      warnings.push(`Bid Decision "${row.bidDecision}" is not in tender.bidDecisionList; saved as-is.`);
    }
    if (row.intent && !config.intentList.includes(row.intent)) {
      warnings.push(`Intent "${row.intent}" is not in tender.intentList; saved as-is.`);
    }
    if (row.outcome && !config.outcomeList.includes(row.outcome)) {
      warnings.push(`Outcome "${row.outcome}" is not in tender.outcomeList; saved as-is.`);
    }

    const tenderKey = `${normalizeKey(row.projectName)}|${clientKey}`;
    const existingTender = existingTenderByKey.get(tenderKey);

    if (row.contact) {
      const group = clientGroups.get(clientKey);
      const matchedContact = group?.contacts.get(normalizeKey(row.contact));
      if (!matchedContact) {
        warnings.push(`Contact "${row.contact}" was not found under client "${row.client}" — left unlinked.`);
      }
    }

    tenders.push({
      action: existingTender ? "update" : "create",
      rowNumber,
      projectName: row.projectName,
      clientKey,
      clientName: row.client,
      contactName: row.contact,
      address: row.address,
      status: row.status,
      received: row.received,
      due: row.due,
      submitted: row.submitted,
      value: row.value ?? 0,
      winProbabilityText,
      bidDecision: row.bidDecision ?? "",
      intent: row.intent ?? "",
      reason: row.reason,
      outcome: row.outcome,
      winningBid: row.winningBid,
      winningCo: row.winningCo,
      priceDeltaPct: row.priceDeltaPct,
      marginPct: row.marginPct,
      warnings,
    });
  });

  return {
    clients,
    suppliers,
    tenders,
    configWarnings: compareConfigSnapshot(parsed.configSnapshot, config),
  };
}

/** Executes a previously-built plan inside a single transaction and returns row counts. */
export async function commitImportPlan(
  plan: ImportPlan,
  db: TenantContext,
  organisationId: string,
  config: TenderConfig
): Promise<ImportReport> {
  const report: ImportReport = {
    clients: { created: 0, updated: 0 },
    suppliers: { created: 0, updated: 0 },
    tenders: { created: 0, updated: 0, skipped: plan.tenders.filter((t) => t.action === "skip").length },
  };

  await db.$transaction(async (tx) => {
    const clientIdByKey = new Map<string, string>();

    for (const row of plan.clients) {
      const client = await tx.client.upsert({
        where: { organisationId_name: { organisationId, name: row.name } },
        create: { organisationId, name: row.name, address: row.address, status: row.status },
        update: { address: row.address, status: row.status },
      });
      clientIdByKey.set(row.key, client.id);
      bump(report.clients, row.action);

      for (const contact of row.contacts) {
        await tx.clientContact.upsert({
          where: { clientId_name: { clientId: client.id, name: contact.name } },
          create: {
            clientId: client.id,
            name: contact.name,
            position: contact.position,
            email: contact.email,
            phone: contact.phone,
            mobile: contact.mobile,
          },
          update: { position: contact.position, email: contact.email, phone: contact.phone, mobile: contact.mobile },
        });
      }
    }

    for (const row of plan.suppliers) {
      // Supplier.contact is nullable, and Prisma's compound-unique shorthand
      // doesn't accept null for a nullable key field, so upsert manually.
      const existing = await tx.supplier.findFirst({
        where: { organisationId, company: row.company, contact: row.contact },
      });
      if (existing) {
        await tx.supplier.update({
          where: { id: existing.id },
          data: { trade: row.trade, email: row.email, phone: row.phone, comments: row.comments },
        });
      } else {
        await tx.supplier.create({
          data: {
            organisationId,
            trade: row.trade,
            company: row.company,
            contact: row.contact,
            email: row.email,
            phone: row.phone,
            comments: row.comments,
          },
        });
      }
      bump(report.suppliers, row.action);
    }

    for (const row of plan.tenders) {
      if (row.action === "skip") continue;
      const clientId = clientIdByKey.get(row.clientKey);
      if (!clientId) continue;

      let contactId: string | null = null;
      if (row.contactName) {
        const contact = await tx.clientContact.findFirst({ where: { clientId, name: row.contactName } });
        contactId = contact?.id ?? null;
      }

      const computed = deriveTenderComputedFields(
        { value: row.value, winProbabilityText: row.winProbabilityText, received: row.received, due: row.due },
        config
      );

      const data = {
        address: row.address,
        status: row.status,
        received: row.received,
        due: row.due,
        submitted: row.submitted,
        value: row.value,
        contactId,
        winProbabilityText: row.winProbabilityText,
        bidDecision: row.bidDecision,
        intent: row.intent,
        reason: row.reason,
        outcome: row.outcome,
        winningBid: row.winningBid,
        winningCo: row.winningCo,
        priceDeltaPct: row.priceDeltaPct,
        marginPct: row.marginPct,
        ...computed,
      };

      await tx.tender.upsert({
        where: { organisationId_projectName_clientId: { organisationId, projectName: row.projectName, clientId } },
        create: { organisationId, clientId, projectName: row.projectName, ...data },
        update: data,
      });
      bump(report.tenders, row.action);
    }
  });

  return report;
}
