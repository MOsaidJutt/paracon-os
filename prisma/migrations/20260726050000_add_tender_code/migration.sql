-- AlterTable
ALTER TABLE "Tender" ADD COLUMN "code" TEXT;

-- Backfill: assign T### to every existing tender, per organisation, oldest
-- received date first (received date is what a real register would have been
-- numbered against as tenders came in; NULL received sorts last via createdAt
-- as the tiebreak). Sequence starts at 1 per org, matching how nextCounterValue
-- (lib/documents/numbering.ts) will continue it for every tender created from
-- here on — this backfill and that counter must agree on where "the next
-- number" starts, so the Counter row is seeded to match in the same pass.
DO $$
DECLARE
  org RECORD;
  t RECORD;
  seq INTEGER;
BEGIN
  FOR org IN SELECT DISTINCT "organisationId" FROM "Tender" LOOP
    seq := 0;
    FOR t IN
      SELECT "id" FROM "Tender"
      WHERE "organisationId" = org."organisationId"
      ORDER BY "received" ASC NULLS LAST, "createdAt" ASC
    LOOP
      seq := seq + 1;
      UPDATE "Tender" SET "code" = 'T' || LPAD(seq::text, 3, '0') WHERE "id" = t."id";
    END LOOP;

    -- Seed the Counter row so the very next tender created continues the
    -- sequence rather than restarting at 1 and colliding with T001. Id built
    -- from md5(random()) rather than gen_random_uuid()/uuid-ossp, neither of
    -- which is guaranteed enabled — md5() needs no extension.
    INSERT INTO "Counter" ("id", "organisationId", "scope", "value")
    VALUES (
      'cnt_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20),
      org."organisationId",
      'TENDER:' || org."organisationId",
      seq
    )
    ON CONFLICT ("organisationId", "scope") DO UPDATE SET "value" = GREATEST("Counter"."value", EXCLUDED."value");
  END LOOP;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "Tender_code_key" ON "Tender"("code");
