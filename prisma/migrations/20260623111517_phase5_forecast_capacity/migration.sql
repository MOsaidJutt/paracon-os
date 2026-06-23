-- CreateTable
CREATE TABLE "ForecastSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL,
    "blockLengthDays" INTEGER NOT NULL,
    "weeksOut" INTEGER NOT NULL,
    "matrixJson" JSONB NOT NULL,
    "heatmapJson" JSONB NOT NULL,
    "headroomJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ForecastSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ForecastSnapshot_organisationId_key" ON "ForecastSnapshot"("organisationId");
