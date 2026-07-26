-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "probability" INTEGER,
ADD COLUMN     "nextAction" TEXT,
ADD COLUMN     "nextActionDate" TIMESTAMP(3);

-- Chasing a lead is driven by what's due next, so the register can sort and
-- filter on it without a full scan once the pipeline grows.
CREATE INDEX "Prospect_organisationId_nextActionDate_idx" ON "Prospect"("organisationId", "nextActionDate");
