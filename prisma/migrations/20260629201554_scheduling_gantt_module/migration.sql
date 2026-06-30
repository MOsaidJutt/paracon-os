-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH');

-- AlterTable
ALTER TABLE "ProgramActivity" ADD COLUMN     "floatDays" INTEGER,
ADD COLUMN     "orderIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "scheduleColumnsJson" JSONB;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'Supplier';

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "stage" TEXT NOT NULL DEFAULT 'Cold',
    "notes" TEXT,
    "convertedTenderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependency" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
    "lagDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelayRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "previousStartDate" TIMESTAMP(3) NOT NULL,
    "previousEndDate" TIMESTAMP(3) NOT NULL,
    "newStartDate" TIMESTAMP(3) NOT NULL,
    "newEndDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "downstreamImpactedJson" JSONB NOT NULL DEFAULT '[]',
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelayRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Baseline" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "savedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Baseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineTask" (
    "id" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "trade" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaselineTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_convertedTenderId_key" ON "Prospect"("convertedTenderId");

-- CreateIndex
CREATE INDEX "Prospect_organisationId_idx" ON "Prospect"("organisationId");

-- CreateIndex
CREATE INDEX "Prospect_organisationId_stage_idx" ON "Prospect"("organisationId", "stage");

-- CreateIndex
CREATE INDEX "Dependency_organisationId_idx" ON "Dependency"("organisationId");

-- CreateIndex
CREATE INDEX "Dependency_predecessorId_idx" ON "Dependency"("predecessorId");

-- CreateIndex
CREATE INDEX "Dependency_successorId_idx" ON "Dependency"("successorId");

-- CreateIndex
CREATE UNIQUE INDEX "Dependency_predecessorId_successorId_key" ON "Dependency"("predecessorId", "successorId");

-- CreateIndex
CREATE INDEX "DelayRecord_organisationId_projectId_idx" ON "DelayRecord"("organisationId", "projectId");

-- CreateIndex
CREATE INDEX "DelayRecord_activityId_idx" ON "DelayRecord"("activityId");

-- CreateIndex
CREATE INDEX "Baseline_organisationId_projectId_idx" ON "Baseline"("organisationId", "projectId");

-- CreateIndex
CREATE INDEX "BaselineTask_baselineId_idx" ON "BaselineTask"("baselineId");

-- CreateIndex
CREATE INDEX "ProgramActivity_parentId_idx" ON "ProgramActivity"("parentId");

-- CreateIndex
CREATE INDEX "Supplier_organisationId_kind_idx" ON "Supplier"("organisationId", "kind");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_convertedTenderId_fkey" FOREIGN KEY ("convertedTenderId") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramActivity" ADD CONSTRAINT "ProgramActivity_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProgramActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "ProgramActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "ProgramActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelayRecord" ADD CONSTRAINT "DelayRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelayRecord" ADD CONSTRAINT "DelayRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelayRecord" ADD CONSTRAINT "DelayRecord_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ProgramActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelayRecord" ADD CONSTRAINT "DelayRecord_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baseline" ADD CONSTRAINT "Baseline_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baseline" ADD CONSTRAINT "Baseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baseline" ADD CONSTRAINT "Baseline_savedByUserId_fkey" FOREIGN KEY ("savedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineTask" ADD CONSTRAINT "BaselineTask_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "Baseline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
