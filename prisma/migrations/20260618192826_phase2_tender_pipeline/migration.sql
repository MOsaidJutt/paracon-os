-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pricing',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "comments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Supplier_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "address" TEXT,
    "status" TEXT NOT NULL,
    "received" DATETIME,
    "due" DATETIME,
    "submitted" DATETIME,
    "value" REAL NOT NULL DEFAULT 0,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT,
    "winProbabilityText" TEXT NOT NULL,
    "winProbabilityNumeric" REAL NOT NULL DEFAULT 0,
    "bidDecision" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "reason" TEXT,
    "outcome" TEXT,
    "winningBid" REAL,
    "winningCo" TEXT,
    "priceDeltaPct" REAL,
    "valueBand" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" TEXT NOT NULL,
    "marginPct" REAL,
    "tenderDurationDays" INTEGER,
    "expectedStart" DATETIME,
    "expectedEnd" DATETIME,
    "expectedLabour" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tender_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Tender_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Tender_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ClientContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Client_organisationId_idx" ON "Client"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_organisationId_name_key" ON "Client"("organisationId", "name");

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientContact_clientId_name_key" ON "ClientContact"("clientId", "name");

-- CreateIndex
CREATE INDEX "Supplier_organisationId_trade_idx" ON "Supplier"("organisationId", "trade");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_organisationId_company_contact_key" ON "Supplier"("organisationId", "company", "contact");

-- CreateIndex
CREATE INDEX "Tender_organisationId_status_idx" ON "Tender"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Tender_organisationId_clientId_idx" ON "Tender"("organisationId", "clientId");

-- CreateIndex
CREATE INDEX "Tender_organisationId_due_idx" ON "Tender"("organisationId", "due");

-- CreateIndex
CREATE INDEX "Tender_organisationId_outcome_idx" ON "Tender"("organisationId", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "Tender_organisationId_projectName_clientId_key" ON "Tender"("organisationId", "projectName", "clientId");
