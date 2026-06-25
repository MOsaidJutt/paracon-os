import { prisma } from "./prisma";

// Models that are not org-scoped — queries on these bypass tenant filtering.
export const UNSCOPED_MODELS = new Set([
  "organisation",
  "module",
  "permission",
  "auditlog", // audit logs are org-scoped but written explicitly; reads go through unscoped
  "clientcontact", // no organisationId of its own — scoped indirectly via its parent Client
  "workerperformance", // no organisationId of its own — scoped indirectly via its parent Worker
  "workerskill", // no organisationId of its own — scoped indirectly via its parent Worker
  "storedfileversion", // no organisationId of its own — scoped indirectly via its parent StoredFile
  "generateddocumentversion", // no organisationId of its own — scoped indirectly via its parent GeneratedDocument
  "attendance", // no organisationId of its own — scoped indirectly via its parent DailySiteUpdate
  "taskprogress", // no organisationId of its own — scoped indirectly via its parent DailySiteUpdate
]);

const WHERE_OPS = new Set([
  "findMany",
  "findFirst",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
]);

/**
 * Pure scoping rule shared by the Prisma extension and its unit tests:
 * injects `organisationId` into `where` (read/update/delete ops) or
 * `data` (create ops) for every org-scoped model, leaving unscoped
 * models and findUnique (no arbitrary where support) untouched.
 */
export function scopeArgs(
  model: string,
  operation: string,
  args: Record<string, unknown>,
  organisationId: string
): Record<string, unknown> {
  if (UNSCOPED_MODELS.has(model.toLowerCase())) return args;

  if (WHERE_OPS.has(operation)) {
    return { ...args, where: { ...(args.where as object), organisationId } };
  }

  if (operation === "create") {
    return { ...args, data: { ...(args.data as object), organisationId } };
  }

  if (operation === "createMany") {
    const rows = Array.isArray(args.data) ? args.data : [args.data];
    return { ...args, data: rows.map((row: object) => ({ ...row, organisationId })) };
  }

  return args;
}

/**
 * Returns a Prisma client that auto-injects `organisationId` on every
 * read and write for org-scoped models. Use this in every server action
 * and route handler that operates on behalf of a tenant.
 */
export function getTenantContext(organisationId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query, model, operation }) {
          return query(scopeArgs(model, operation, args, organisationId));
        },
      },
    },
  });
}

export type TenantContext = ReturnType<typeof getTenantContext>;
