-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "status" TEXT NOT NULL,
    "value" REAL NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "clientId" TEXT NOT NULL,
    "sourceTenderId" TEXT,
    "pmUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_sourceTenderId_fkey" FOREIGN KEY ("sourceTenderId") REFERENCES "Tender" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_pmUserId_fkey" FOREIGN KEY ("pmUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "milestoneType" TEXT,
    "status" TEXT NOT NULL,
    "labourRequired" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProgramActivity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "milestoneType" TEXT,
    "sourceActivityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Milestone_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Milestone_sourceActivityId_fkey" FOREIGN KEY ("sourceActivityId") REFERENCES "ProgramActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_sourceTenderId_key" ON "Project"("sourceTenderId");

-- CreateIndex
CREATE INDEX "Project_organisationId_status_idx" ON "Project"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Project_organisationId_clientId_idx" ON "Project"("organisationId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_organisationId_code_key" ON "Project"("organisationId", "code");

-- CreateIndex
CREATE INDEX "ProgramActivity_organisationId_idx" ON "ProgramActivity"("organisationId");

-- CreateIndex
CREATE INDEX "ProgramActivity_projectId_startDate_idx" ON "ProgramActivity"("projectId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_sourceActivityId_key" ON "Milestone"("sourceActivityId");

-- CreateIndex
CREATE INDEX "Milestone_organisationId_idx" ON "Milestone"("organisationId");

-- CreateIndex
CREATE INDEX "Milestone_projectId_date_idx" ON "Milestone"("projectId", "date");
