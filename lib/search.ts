import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { formatCurrency, formatDate } from "@/lib/tenders/format";

export type SearchResultType = "project" | "tender" | "worker" | "document" | "client" | "supplier";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /** Key/value pairs rendered in the hover-to-preview card — no extra click needed to see them. */
  preview: Record<string, string>;
};

const RESULT_LIMIT_PER_TYPE = 6;
const MIN_QUERY_LENGTH = 2;

async function searchProjects(organisationId: string, query: string): Promise<SearchResult[]> {
  const projects = await prisma.project.findMany({
    where: {
      organisationId,
      OR: [{ name: { contains: query } }, { code: { contains: query } }, { address: { contains: query } }],
    },
    include: { client: { select: { name: true } } },
    take: RESULT_LIMIT_PER_TYPE,
  });

  return projects.map((p) => ({
    type: "project",
    id: p.id,
    title: p.name,
    subtitle: `${p.code} · ${p.client.name}`,
    href: `/projects/${p.id}`,
    preview: {
      Status: p.status,
      Value: formatCurrency(p.value),
      Client: p.client.name,
      ...(p.address ? { Address: p.address } : {}),
    },
  }));
}

async function searchTenders(organisationId: string, query: string): Promise<SearchResult[]> {
  const tenders = await prisma.tender.findMany({
    where: {
      organisationId,
      OR: [{ projectName: { contains: query } }, { address: { contains: query } }],
    },
    include: { client: { select: { name: true } } },
    take: RESULT_LIMIT_PER_TYPE,
  });

  return tenders.map((t) => ({
    type: "tender",
    id: t.id,
    title: t.projectName,
    subtitle: `${t.client.name} · ${t.status}`,
    href: `/tenders`,
    preview: {
      Status: t.status,
      Value: formatCurrency(t.value),
      ...(t.due ? { Due: formatDate(t.due) } : {}),
      Client: t.client.name,
    },
  }));
}

async function searchWorkers(organisationId: string, query: string): Promise<SearchResult[]> {
  const workers = await prisma.worker.findMany({
    where: { organisationId, name: { contains: query } },
    include: { compliance: { select: { status: true } } },
    take: RESULT_LIMIT_PER_TYPE,
  });

  return workers.map((w) => {
    const hasExpired = w.compliance.some((c) => c.status === "Expired");
    const hasExpiring = w.compliance.some((c) => c.status === "Expiring");
    return {
      type: "worker" as const,
      id: w.id,
      title: w.name,
      subtitle: `${w.capability} · ${w.status}`,
      href: `/labour/${w.id}`,
      preview: {
        Trade: w.capability,
        Availability: w.status,
        ...(w.baseLocation ? { "Base location": w.baseLocation } : {}),
        Compliance: hasExpired ? "Expired item(s)" : hasExpiring ? "Expiring soon" : "Valid",
      },
    };
  });
}

async function searchClients(organisationId: string, query: string): Promise<SearchResult[]> {
  const clients = await prisma.client.findMany({
    where: { organisationId, name: { contains: query } },
    take: RESULT_LIMIT_PER_TYPE,
  });

  return clients.map((c) => ({
    type: "client" as const,
    id: c.id,
    title: c.name,
    subtitle: c.status,
    href: "/contacts/clients",
    preview: {
      Status: c.status,
      ...(c.address ? { Address: c.address } : {}),
    },
  }));
}

async function searchSuppliers(organisationId: string, query: string): Promise<SearchResult[]> {
  const suppliers = await prisma.supplier.findMany({
    where: { organisationId, OR: [{ company: { contains: query } }, { trade: { contains: query } }] },
    take: RESULT_LIMIT_PER_TYPE,
  });

  return suppliers.map((s) => ({
    type: "supplier" as const,
    id: s.id,
    title: s.company,
    subtitle: `${s.trade} · ${s.kind}`,
    href: "/contacts/suppliers",
    preview: {
      Trade: s.trade,
      Kind: s.kind,
      ...(s.contact ? { Contact: s.contact } : {}),
    },
  }));
}

async function searchDocuments(organisationId: string, query: string): Promise<SearchResult[]> {
  const [stored, linked] = await Promise.all([
    prisma.storedFile.findMany({
      where: { organisationId, name: { contains: query } },
      include: { project: { select: { id: true, name: true } }, tender: { select: { id: true, projectName: true } } },
      take: RESULT_LIMIT_PER_TYPE,
    }),
    prisma.linkedDocument.findMany({
      where: { organisationId, name: { contains: query } },
      include: { project: { select: { id: true, name: true } }, tender: { select: { id: true, projectName: true } } },
      take: RESULT_LIMIT_PER_TYPE,
    }),
  ]);

  const storedResults: SearchResult[] = stored.map((f) => ({
    type: "document",
    id: f.id,
    title: f.name,
    subtitle: f.project ? f.project.name : f.tender ? f.tender.projectName : "Document",
    href: f.project ? `/projects/${f.project.id}` : "/tenders",
    preview: {
      Category: f.category,
      Version: `v${f.version}`,
      "Size": `${Math.round(f.size / 1024)} KB`,
    },
  }));

  const linkedResults: SearchResult[] = linked.map((d) => ({
    type: "document",
    id: d.id,
    title: d.name,
    subtitle: d.project ? d.project.name : d.tender ? d.tender.projectName : "Linked document",
    href: d.driveUrl,
    preview: { Kind: d.kind, Source: "Google Drive (linked)" },
  }));

  return [...storedResults, ...linkedResults].slice(0, RESULT_LIMIT_PER_TYPE);
}

/** Org-scoped, permission-filtered search across Projects/Tenders/Workers/Documents — powers the topbar command palette. */
export async function searchAll(organisationId: string, session: Session, rawQuery: string): Promise<SearchResult[]> {
  const query = rawQuery.trim();
  if (query.length < MIN_QUERY_LENGTH) return [];

  const tasks: Promise<SearchResult[]>[] = [];
  if (hasPermission(session, "project.view")) tasks.push(searchProjects(organisationId, query));
  if (hasPermission(session, "tender.view")) tasks.push(searchTenders(organisationId, query));
  if (hasPermission(session, "labour.view")) tasks.push(searchWorkers(organisationId, query));
  if (hasPermission(session, "doc.view")) tasks.push(searchDocuments(organisationId, query));
  const canViewContacts = hasPermission(session, "tender.view") || hasPermission(session, "labour.view");
  if (canViewContacts) {
    tasks.push(searchClients(organisationId, query));
    tasks.push(searchSuppliers(organisationId, query));
  }

  const results = await Promise.all(tasks);
  return results.flat();
}
