-- AlterEnum
ALTER TYPE "ConfigType" ADD VALUE 'CHECKLIST';

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiChecklistTick" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "tickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiChecklistTick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPreference_organisationId_idx" ON "UserPreference"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_organisationId_userId_key_key" ON "UserPreference"("organisationId", "userId", "key");

-- CreateIndex
CREATE INDEX "KpiChecklistTick_organisationId_userId_periodKey_idx" ON "KpiChecklistTick"("organisationId", "userId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "KpiChecklistTick_organisationId_userId_itemKey_periodKey_key" ON "KpiChecklistTick"("organisationId", "userId", "itemKey", "periodKey");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiChecklistTick" ADD CONSTRAINT "KpiChecklistTick_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiChecklistTick" ADD CONSTRAINT "KpiChecklistTick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
