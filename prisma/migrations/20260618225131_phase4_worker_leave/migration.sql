-- CreateTable
CREATE TABLE "WorkerLeave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkerLeave_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkerLeave_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WorkerLeave_organisationId_idx" ON "WorkerLeave"("organisationId");

-- CreateIndex
CREATE INDEX "WorkerLeave_workerId_startDate_endDate_idx" ON "WorkerLeave"("workerId", "startDate", "endDate");
