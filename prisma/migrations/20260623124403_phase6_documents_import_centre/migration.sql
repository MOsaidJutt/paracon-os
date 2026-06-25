-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL,
    "previewKey" TEXT,
    "tagsJson" JSONB NOT NULL DEFAULT [],
    "projectId" TEXT,
    "tenderId" TEXT,
    "workerId" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoredFile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoredFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoredFile_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoredFile_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoredFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoredFileVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storedFileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredFileVersion_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "StoredFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoredFileVersion_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LinkedDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driveUrl" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "projectId" TEXT,
    "tenderId" TEXT,
    "addedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LinkedDocument_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LinkedDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LinkedDocument_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LinkedDocument_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "importerKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "stagedKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "summaryJson" JSONB,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportJob_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EstimateLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "tenderId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "unitRate" REAL,
    "amount" REAL,
    "remarks" TEXT,
    "source" TEXT NOT NULL DEFAULT 'zztakeoff',
    "importJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EstimateLineItem_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EstimateLineItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EstimateLineItem_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EstimateLineItem_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StoredFile_organisationId_projectId_idx" ON "StoredFile"("organisationId", "projectId");

-- CreateIndex
CREATE INDEX "StoredFile_organisationId_tenderId_idx" ON "StoredFile"("organisationId", "tenderId");

-- CreateIndex
CREATE INDEX "StoredFile_organisationId_workerId_idx" ON "StoredFile"("organisationId", "workerId");

-- CreateIndex
CREATE INDEX "StoredFile_organisationId_category_idx" ON "StoredFile"("organisationId", "category");

-- CreateIndex
CREATE INDEX "StoredFileVersion_storedFileId_idx" ON "StoredFileVersion"("storedFileId");

-- CreateIndex
CREATE INDEX "LinkedDocument_organisationId_projectId_idx" ON "LinkedDocument"("organisationId", "projectId");

-- CreateIndex
CREATE INDEX "LinkedDocument_organisationId_tenderId_idx" ON "LinkedDocument"("organisationId", "tenderId");

-- CreateIndex
CREATE INDEX "ImportJob_organisationId_importerKey_contentHash_idx" ON "ImportJob"("organisationId", "importerKey", "contentHash");

-- CreateIndex
CREATE INDEX "EstimateLineItem_organisationId_projectId_idx" ON "EstimateLineItem"("organisationId", "projectId");

-- CreateIndex
CREATE INDEX "EstimateLineItem_organisationId_tenderId_idx" ON "EstimateLineItem"("organisationId", "tenderId");
