-- AlterTable
ALTER TABLE "ProgramActivity" ADD COLUMN "responsible" TEXT;

-- Backfill every existing activity with its project's PM name, so no row on
-- the Gantt reads blank once the column ships. New activities get the same
-- default applied server-side at creation (lib validated, not a DB default,
-- since it needs the PM's live name rather than a fixed string).
UPDATE "ProgramActivity" AS pa
SET "responsible" = u."name"
FROM "Project" p
JOIN "User" u ON u."id" = p."pmUserId"
WHERE pa."projectId" = p."id"
  AND pa."responsible" IS NULL
  AND p."pmUserId" IS NOT NULL;
