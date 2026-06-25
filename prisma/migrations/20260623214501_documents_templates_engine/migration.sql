-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN "abn" TEXT;
ALTER TABLE "Organisation" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Organisation" ADD COLUMN "registeredAddress" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "tradePackages" JSONB;

-- AlterTable
ALTER TABLE "Tender" ADD COLUMN "tradePackages" JSONB;

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentTemplate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "projectId" TEXT,
    "tenderId" TEXT,
    "number" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "dataSnapshotJson" JSONB NOT NULL,
    "pdfFileId" TEXT,
    "xlsxFileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Issued',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedDocument_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneratedDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneratedDocument_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneratedDocument_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "StoredFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GeneratedDocument_xlsxFileId_fkey" FOREIGN KEY ("xlsxFileId") REFERENCES "StoredFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GeneratedDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedDocumentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generatedDocumentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "dataSnapshotJson" JSONB NOT NULL,
    "pdfFileId" TEXT,
    "xlsxFileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedDocumentVersion_generatedDocumentId_fkey" FOREIGN KEY ("generatedDocumentId") REFERENCES "GeneratedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Counter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Counter_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_organisationId_type_key" ON "DocumentTemplate"("organisationId", "type");

-- CreateIndex
CREATE INDEX "GeneratedDocument_organisationId_projectId_idx" ON "GeneratedDocument"("organisationId", "projectId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_organisationId_tenderId_idx" ON "GeneratedDocument"("organisationId", "tenderId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_organisationId_type_idx" ON "GeneratedDocument"("organisationId", "type");

-- CreateIndex
CREATE INDEX "GeneratedDocumentVersion_generatedDocumentId_idx" ON "GeneratedDocumentVersion"("generatedDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Counter_organisationId_scope_key" ON "Counter"("organisationId", "scope");
