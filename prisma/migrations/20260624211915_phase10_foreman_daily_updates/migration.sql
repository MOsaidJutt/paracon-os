-- CreateTable
CREATE TABLE "DailySiteUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "foremanUserId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "weatherNote" TEXT,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailySiteUpdate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailySiteUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailySiteUpdate_foremanUserId_fkey" FOREIGN KEY ("foremanUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailySiteUpdateId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL,
    "hours" REAL,
    CONSTRAINT "Attendance_dailySiteUpdateId_fkey" FOREIGN KEY ("dailySiteUpdateId") REFERENCES "DailySiteUpdate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attendance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailySiteUpdateId" TEXT NOT NULL,
    "programActivityId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "TaskProgress_dailySiteUpdateId_fkey" FOREIGN KEY ("dailySiteUpdateId") REFERENCES "DailySiteUpdate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskProgress_programActivityId_fkey" FOREIGN KEY ("programActivityId") REFERENCES "ProgramActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dailySiteUpdateId" TEXT,
    "raisedByUserId" TEXT,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "clientRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Issue_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Issue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Issue_dailySiteUpdateId_fkey" FOREIGN KEY ("dailySiteUpdateId") REFERENCES "DailySiteUpdate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Issue_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "poId" TEXT,
    "supplierId" TEXT,
    "itemsJson" JSONB NOT NULL DEFAULT [],
    "expectedDate" DATETIME,
    "deliveredDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "dailySiteUpdateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Delivery_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Delivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Delivery_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_dailySiteUpdateId_fkey" FOREIGN KEY ("dailySiteUpdateId") REFERENCES "DailySiteUpdate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Delivery" ("createdAt", "deliveredDate", "expectedDate", "id", "itemsJson", "organisationId", "poId", "projectId", "status", "supplierId", "updatedAt") SELECT "createdAt", "deliveredDate", "expectedDate", "id", "itemsJson", "organisationId", "poId", "projectId", "status", "supplierId", "updatedAt" FROM "Delivery";
DROP TABLE "Delivery";
ALTER TABLE "new_Delivery" RENAME TO "Delivery";
CREATE INDEX "Delivery_organisationId_projectId_idx" ON "Delivery"("organisationId", "projectId");
CREATE INDEX "Delivery_organisationId_poId_idx" ON "Delivery"("organisationId", "poId");
CREATE INDEX "Delivery_organisationId_status_idx" ON "Delivery"("organisationId", "status");
CREATE INDEX "Delivery_organisationId_dailySiteUpdateId_idx" ON "Delivery"("organisationId", "dailySiteUpdateId");
CREATE TABLE "new_Project" (
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
    "foremanUserId" TEXT,
    "tradePackages" JSONB,
    "costBudget" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_sourceTenderId_fkey" FOREIGN KEY ("sourceTenderId") REFERENCES "Tender" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_pmUserId_fkey" FOREIGN KEY ("pmUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_foremanUserId_fkey" FOREIGN KEY ("foremanUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("address", "clientId", "code", "costBudget", "createdAt", "endDate", "id", "name", "organisationId", "pmUserId", "sourceTenderId", "startDate", "status", "tradePackages", "updatedAt", "value") SELECT "address", "clientId", "code", "costBudget", "createdAt", "endDate", "id", "name", "organisationId", "pmUserId", "sourceTenderId", "startDate", "status", "tradePackages", "updatedAt", "value" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_sourceTenderId_key" ON "Project"("sourceTenderId");
CREATE INDEX "Project_organisationId_status_idx" ON "Project"("organisationId", "status");
CREATE INDEX "Project_organisationId_clientId_idx" ON "Project"("organisationId", "clientId");
CREATE UNIQUE INDEX "Project_organisationId_code_key" ON "Project"("organisationId", "code");
CREATE TABLE "new_StoredFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL,
    "caption" TEXT,
    "clientRef" TEXT,
    "previewKey" TEXT,
    "tagsJson" JSONB NOT NULL DEFAULT [],
    "projectId" TEXT,
    "tenderId" TEXT,
    "workerId" TEXT,
    "dailySiteUpdateId" TEXT,
    "issueId" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoredFile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoredFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoredFile_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoredFile_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoredFile_dailySiteUpdateId_fkey" FOREIGN KEY ("dailySiteUpdateId") REFERENCES "DailySiteUpdate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoredFile_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoredFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StoredFile" ("category", "createdAt", "id", "key", "mime", "name", "organisationId", "previewKey", "projectId", "size", "tagsJson", "tenderId", "updatedAt", "uploadedByUserId", "version", "workerId") SELECT "category", "createdAt", "id", "key", "mime", "name", "organisationId", "previewKey", "projectId", "size", "tagsJson", "tenderId", "updatedAt", "uploadedByUserId", "version", "workerId" FROM "StoredFile";
DROP TABLE "StoredFile";
ALTER TABLE "new_StoredFile" RENAME TO "StoredFile";
CREATE INDEX "StoredFile_organisationId_projectId_idx" ON "StoredFile"("organisationId", "projectId");
CREATE INDEX "StoredFile_organisationId_tenderId_idx" ON "StoredFile"("organisationId", "tenderId");
CREATE INDEX "StoredFile_organisationId_workerId_idx" ON "StoredFile"("organisationId", "workerId");
CREATE INDEX "StoredFile_organisationId_category_idx" ON "StoredFile"("organisationId", "category");
CREATE INDEX "StoredFile_organisationId_dailySiteUpdateId_idx" ON "StoredFile"("organisationId", "dailySiteUpdateId");
CREATE INDEX "StoredFile_organisationId_issueId_idx" ON "StoredFile"("organisationId", "issueId");
CREATE UNIQUE INDEX "StoredFile_organisationId_clientRef_key" ON "StoredFile"("organisationId", "clientRef");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DailySiteUpdate_organisationId_projectId_date_idx" ON "DailySiteUpdate"("organisationId", "projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailySiteUpdate_organisationId_projectId_foremanUserId_date_key" ON "DailySiteUpdate"("organisationId", "projectId", "foremanUserId", "date");

-- CreateIndex
CREATE INDEX "Attendance_workerId_idx" ON "Attendance"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_dailySiteUpdateId_workerId_key" ON "Attendance"("dailySiteUpdateId", "workerId");

-- CreateIndex
CREATE INDEX "TaskProgress_programActivityId_idx" ON "TaskProgress"("programActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskProgress_dailySiteUpdateId_programActivityId_key" ON "TaskProgress"("dailySiteUpdateId", "programActivityId");

-- CreateIndex
CREATE INDEX "Issue_organisationId_projectId_idx" ON "Issue"("organisationId", "projectId");

-- CreateIndex
CREATE INDEX "Issue_organisationId_status_idx" ON "Issue"("organisationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_organisationId_clientRef_key" ON "Issue"("organisationId", "clientRef");
