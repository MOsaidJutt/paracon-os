-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "photoUrl" TEXT,
    "capability" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "baseLocation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Worker_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerPerformance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "quality" REAL NOT NULL DEFAULT 0,
    "reliability" REAL NOT NULL DEFAULT 0,
    "productivity" REAL NOT NULL DEFAULT 0,
    "safety" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkerPerformance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Compliance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT,
    "issuedDate" DATETIME,
    "expiryDate" DATETIME,
    "docUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Valid',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Compliance_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Compliance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Skill_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerSkill" (
    "workerId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("workerId", "skillId"),
    CONSTRAINT "WorkerSkill_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkerSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Worker_organisationId_capability_idx" ON "Worker"("organisationId", "capability");

-- CreateIndex
CREATE INDEX "Worker_organisationId_status_idx" ON "Worker"("organisationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerPerformance_workerId_key" ON "WorkerPerformance"("workerId");

-- CreateIndex
CREATE INDEX "Compliance_organisationId_status_idx" ON "Compliance"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Compliance_workerId_idx" ON "Compliance"("workerId");

-- CreateIndex
CREATE INDEX "Compliance_expiryDate_idx" ON "Compliance"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_organisationId_name_key" ON "Skill"("organisationId", "name");
