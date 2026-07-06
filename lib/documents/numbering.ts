import { prisma } from "@/lib/prisma";

/**
 * Atomic per-org sequence numbers, keyed by an arbitrary scope string (e.g.
 * "VARIATION:<projectId>", "PROGRESS_CLAIM:<projectId>", "TENDER_LETTER:<tenderId>")
 * so VQ-## / Claim # reset per project while staying race-safe under
 * concurrent generation requests.
 *
 * Uses the raw `prisma` client rather than a tenant-scoped `TenantContext`:
 * the tenant Prisma extension (lib/tenant.ts) only auto-injects organisationId
 * for find/update/delete/create — NOT for `upsert`, whose where/create/update
 * all need it spelled out explicitly here. `organisationId` is always the
 * caller's own session org (never client input), so this is safe.
 */
export async function nextCounterValue(organisationId: string, scope: string): Promise<number> {
  const counter = await prisma.counter.upsert({
    where: { organisationId_scope: { organisationId, scope } },
    update: { value: { increment: 1 } },
    create: { organisationId, scope, value: 1 },
  });
  return counter.value;
}

/** Zero-pads (when padding > 0) and prepends the configured prefix — e.g. ("VQ-", 2, 3) -> "VQ-03". */
export function formatDocumentNumber(prefix: string, padding: number, sequence: number): string {
  const digits = padding > 0 ? String(sequence).padStart(padding, "0") : String(sequence);
  return `${prefix}${digits}`;
}

export function variationCounterScope(projectId: string): string {
  return `VARIATION:${projectId}`;
}

export function progressClaimCounterScope(projectId: string): string {
  return `PROGRESS_CLAIM:${projectId}`;
}

export function tenderLetterCounterScope(tenderId: string): string {
  return `TENDER_LETTER:${tenderId}`;
}

export function swmsCounterScope(projectId: string): string {
  return `SWMS:${projectId}`;
}
