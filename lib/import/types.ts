import type { TenantContext } from "@/lib/tenant";

export type ImporterContext = {
  db: TenantContext;
  organisationId: string;
  userId: string;
  importJobId: string;
};

/**
 * A pluggable importer always re-derives its plan AND its commit straight
 * from the raw uploaded buffer (+ any importer-specific `extra` input the
 * user supplied, e.g. zztakeoff's column map / target project) — it never
 * trusts a plan object round-tripped back from the client. The outer
 * stage-then-commit orchestration (lib/import/jobs.ts) layers idempotency
 * and audit logging on top, identical for every importer.
 */
export interface Importer {
  key: string;
  label: string;
  description: string;
  acceptedExtensions: string[];
  /** True if the caller must supply `extra` (a target project/tender id, a column map, etc.) before commit can run. */
  requiresExtra: boolean;
  parsePreview(buffer: Buffer, ctx: ImporterContext, extra?: Record<string, unknown>): Promise<{ plan: unknown; summary: unknown }>;
  commit(buffer: Buffer, ctx: ImporterContext, extra?: Record<string, unknown>): Promise<{ report: unknown }>;
}
