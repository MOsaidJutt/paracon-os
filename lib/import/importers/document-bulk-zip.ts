import AdmZip from "adm-zip";
import type { TenantContext } from "@/lib/tenant";
import { putObject } from "@/lib/storage";
import { buildDocumentKey } from "@/lib/documents/storage-keys";
import { normalizeKey } from "@/lib/tenders/xlsx-parse";
import type { Importer } from "../types";

type MatchType = "project" | "tender" | "unmatched";

export type ZipPlanRow = {
  entryPath: string;
  fileName: string;
  size: number;
  matchType: MatchType;
  matchedId: string | null;
  matchedName: string | null;
  category: string;
};

export type ZipPlan = { rows: ZipPlanRow[] };

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  txt: "text/plain",
  eml: "message/rfc822",
};

export function guessMimeFromName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

/**
 * Best-effort folder/file-name keyword match to one of the master template's
 * document sections (INTAKE_NOTES.md §9) — never authoritative, just a sane
 * default category the user can re-tag after import.
 */
export function guessCategory(entryPath: string): string {
  const lower = entryPath.toLowerCase();
  if (lower.includes("variation") || lower.includes("claim") || lower.includes("invoice") || lower.includes("statutory"))
    return "Submission, Contract & Claims";
  if (lower.includes("quote") || lower.includes("purchase order")) return "Quotes & Purchase Orders";
  if (
    lower.includes("handover") ||
    lower.includes("compliance certif") ||
    lower.includes("defect") ||
    lower.includes("greenstar") ||
    lower.includes("o&m")
  )
    return "Handover Manual";
  if (lower.includes("site file") || lower.includes("swms") || lower.includes("sign-on") || lower.includes("sign off"))
    return "Site File";
  if (lower.includes("measure") || lower.includes("takeoff") || lower.includes("take-off")) return "Measure";
  if (lower.includes("supplier quote")) return "Supplier Quotes";
  if (lower.includes("submission") || lower.includes("tender letter")) return "Submission";
  if (
    lower.includes("addenda") ||
    lower.includes("site photo") ||
    lower.includes("architectural") ||
    lower.includes("specification") ||
    lower.includes("reference")
  )
    return "Documentation";
  return "General";
}

function lastSegment(entryPath: string): string {
  const parts = entryPath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? entryPath;
}

function topLevelFolder(entryPath: string): string {
  const parts = entryPath.split("/").filter(Boolean);
  return parts[0] ?? "";
}

type MatchTarget = { matchType: MatchType; matchedId: string | null; matchedName: string | null };

type LookupMaps = {
  projectsByKey: Map<string, { id: string; name: string }>;
  tendersByKey: Map<string, { id: string; name: string }>;
};

/** Preloaded once per preview/commit call (not per zip entry) — avoids an N+1 query and gives case-insensitive matching on SQLite/Postgres alike. */
async function loadLookupMaps(db: TenantContext): Promise<LookupMaps> {
  const [projects, tenders] = await Promise.all([
    db.project.findMany({ select: { id: true, name: true } }),
    db.tender.findMany({ select: { id: true, projectName: true } }),
  ]);
  return {
    projectsByKey: new Map(projects.map((p) => [normalizeKey(p.name), p])),
    tendersByKey: new Map(tenders.map((t) => [normalizeKey(t.projectName), { id: t.id, name: t.projectName }])),
  };
}

function matchEntry(entryPath: string, maps: LookupMaps): MatchTarget {
  const candidateNames = [topLevelFolder(entryPath), lastSegment(entryPath).replace(/\.[^.]+$/, "")];

  for (const candidate of candidateNames) {
    if (!candidate) continue;
    const key = normalizeKey(candidate);
    const project = maps.projectsByKey.get(key);
    if (project) return { matchType: "project", matchedId: project.id, matchedName: project.name };

    const tender = maps.tendersByKey.get(key);
    if (tender) return { matchType: "tender", matchedId: tender.id, matchedName: tender.name };
  }
  return { matchType: "unmatched", matchedId: null, matchedName: null };
}

export const documentBulkZipImporter: Importer = {
  key: "document-bulk-zip",
  label: "Bulk document zip (Dropbox/Drive export)",
  description: "Unzips a folder export and attaches each file to the matching project or tender by folder/file name.",
  acceptedExtensions: [".zip"],
  requiresExtra: false,

  async parsePreview(buffer, ctx) {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    const maps = await loadLookupMaps(ctx.db);

    const rows: ZipPlanRow[] = entries.map((entry) => {
      const match = matchEntry(entry.entryName, maps);
      return {
        entryPath: entry.entryName,
        fileName: lastSegment(entry.entryName),
        size: entry.header.size,
        matchType: match.matchType,
        matchedId: match.matchedId,
        matchedName: match.matchedName,
        category: guessCategory(entry.entryName),
      };
    });

    const plan: ZipPlan = { rows };
    const summary = {
      total: rows.length,
      matchedProjects: rows.filter((r) => r.matchType === "project").length,
      matchedTenders: rows.filter((r) => r.matchType === "tender").length,
      unmatched: rows.filter((r) => r.matchType === "unmatched").length,
    };
    return { plan, summary };
  },

  async commit(buffer, ctx) {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    const maps = await loadLookupMaps(ctx.db);

    let attached = 0;
    let skippedExisting = 0;
    let unmatched = 0;

    for (const entry of entries) {
      const match = matchEntry(entry.entryName, maps);
      if (match.matchType === "unmatched" || !match.matchedId) {
        unmatched++;
        continue;
      }

      const fileName = lastSegment(entry.entryName);
      const category = guessCategory(entry.entryName);
      const target = match.matchType === "project" ? { projectId: match.matchedId } : { tenderId: match.matchedId };

      const existing = await ctx.db.storedFile.findFirst({ where: { ...target, name: fileName } });
      if (existing) {
        skippedExisting++;
        continue;
      }

      const fileBuffer = entry.getData();
      const mime = guessMimeFromName(fileName);
      const key = buildDocumentKey(ctx.organisationId, target, fileName);
      await putObject(key, fileBuffer, mime);

      await ctx.db.storedFile.create({
        data: {
          organisationId: ctx.organisationId,
          key,
          name: fileName,
          mime,
          size: fileBuffer.length,
          category,
          uploadedByUserId: ctx.userId,
          ...target,
        },
      });
      attached++;
    }

    return { report: { attached, skippedExisting, unmatched } };
  },
};
