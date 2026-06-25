-- AlterTable
ALTER TABLE "Project" ADD COLUMN "costBudget" REAL;

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supplierId" TEXT,
    "number" TEXT NOT NULL,
    "itemsJson" JSONB NOT NULL DEFAULT [],
    "value" REAL NOT NULL DEFAULT 0,
    "expectedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "poId" TEXT,
    "supplierId" TEXT,
    "itemsJson" JSONB NOT NULL DEFAULT [],
    "expectedDate" DATETIME,
    "deliveredDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Delivery_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Delivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Delivery_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierBill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "supplierId" TEXT,
    "supplierNameRaw" TEXT,
    "poId" TEXT,
    "billFileId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceDate" DATETIME,
    "amountExGst" REAL NOT NULL DEFAULT 0,
    "gstAmount" REAL NOT NULL DEFAULT 0,
    "amountIncGst" REAL NOT NULL DEFAULT 0,
    "jobNumberRaw" TEXT,
    "allocationStatus" TEXT NOT NULL DEFAULT 'Unallocated',
    "status" TEXT NOT NULL DEFAULT 'Received',
    "orderedConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "receivedConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "quantityConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "priceConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "lastDecisionByUserId" TEXT,
    "lastDecisionAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'Manual',
    "emailMessageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplierBill_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierBill_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierBill_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierBill_billFileId_fkey" FOREIGN KEY ("billFileId") REFERENCES "StoredFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierBill_lastDecisionByUserId_fkey" FOREIGN KEY ("lastDecisionByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Variation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generatedDocumentId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "decidedByUserId" TEXT,
    "decidedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Variation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Variation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Variation_generatedDocumentId_fkey" FOREIGN KEY ("generatedDocumentId") REFERENCES "GeneratedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Variation_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgressClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generatedDocumentId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "claimedAmountExGst" REAL NOT NULL,
    "claimedAmountIncGst" REAL NOT NULL,
    "retentionPct" REAL NOT NULL DEFAULT 0,
    "retentionHeld" REAL NOT NULL DEFAULT 0,
    "statDeclarationFileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "certifiedAmount" REAL,
    "certifiedAt" DATETIME,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "paidAt" DATETIME,
    "decidedByUserId" TEXT,
    "decidedAt" DATETIME,
    "issuedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProgressClaim_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgressClaim_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgressClaim_generatedDocumentId_fkey" FOREIGN KEY ("generatedDocumentId") REFERENCES "GeneratedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgressClaim_statDeclarationFileId_fkey" FOREIGN KEY ("statDeclarationFileId") REFERENCES "StoredFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProgressClaim_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetentionRelease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PracticalCompletion',
    "note" TEXT,
    "recordedByUserId" TEXT,
    "releasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetentionRelease_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RetentionRelease_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RetentionRelease_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MailboxSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 993,
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "useTls" BOOLEAN NOT NULL DEFAULT true,
    "folder" TEXT NOT NULL DEFAULT 'INBOX',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenUid" INTEGER NOT NULL DEFAULT 0,
    "lastPolledAt" DATETIME,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MailboxSetting_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PurchaseOrder_organisationId_projectId_idx" ON "PurchaseOrder"("organisationId", "projectId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organisationId_status_idx" ON "PurchaseOrder"("organisationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_organisationId_projectId_number_key" ON "PurchaseOrder"("organisationId", "projectId", "number");

-- CreateIndex
CREATE INDEX "Delivery_organisationId_projectId_idx" ON "Delivery"("organisationId", "projectId");

-- CreateIndex
CREATE INDEX "Delivery_organisationId_poId_idx" ON "Delivery"("organisationId", "poId");

-- CreateIndex
CREATE INDEX "Delivery_organisationId_status_idx" ON "Delivery"("organisationId", "status");

-- CreateIndex
CREATE INDEX "SupplierBill_organisationId_projectId_idx" ON "SupplierBill"("organisationId", "projectId");

-- CreateIndex
CREATE INDEX "SupplierBill_organisationId_allocationStatus_idx" ON "SupplierBill"("organisationId", "allocationStatus");

-- CreateIndex
CREATE INDEX "SupplierBill_organisationId_status_idx" ON "SupplierBill"("organisationId", "status");

-- CreateIndex
CREATE INDEX "SupplierBill_organisationId_poId_idx" ON "SupplierBill"("organisationId", "poId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierBill_organisationId_emailMessageId_key" ON "SupplierBill"("organisationId", "emailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Variation_generatedDocumentId_key" ON "Variation"("generatedDocumentId");

-- CreateIndex
CREATE INDEX "Variation_organisationId_projectId_idx" ON "Variation"("organisationId", "projectId");

-- CreateIndex
CREATE INDEX "Variation_organisationId_status_idx" ON "Variation"("organisationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressClaim_generatedDocumentId_key" ON "ProgressClaim"("generatedDocumentId");

-- CreateIndex
CREATE INDEX "ProgressClaim_organisationId_projectId_idx" ON "ProgressClaim"("organisationId", "projectId");

-- CreateIndex
CREATE INDEX "ProgressClaim_organisationId_status_idx" ON "ProgressClaim"("organisationId", "status");

-- CreateIndex
CREATE INDEX "RetentionRelease_organisationId_projectId_idx" ON "RetentionRelease"("organisationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MailboxSetting_organisationId_key" ON "MailboxSetting"("organisationId");
