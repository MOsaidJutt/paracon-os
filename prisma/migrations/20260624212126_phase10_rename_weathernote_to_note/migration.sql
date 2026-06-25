/*
  Warnings:

  - You are about to drop the column `weatherNote` on the `DailySiteUpdate` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailySiteUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "foremanUserId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "note" TEXT,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailySiteUpdate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailySiteUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailySiteUpdate_foremanUserId_fkey" FOREIGN KEY ("foremanUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DailySiteUpdate" ("createdAt", "date", "foremanUserId", "id", "organisationId", "projectId", "submittedAt", "updatedAt") SELECT "createdAt", "date", "foremanUserId", "id", "organisationId", "projectId", "submittedAt", "updatedAt" FROM "DailySiteUpdate";
DROP TABLE "DailySiteUpdate";
ALTER TABLE "new_DailySiteUpdate" RENAME TO "DailySiteUpdate";
CREATE INDEX "DailySiteUpdate_organisationId_projectId_date_idx" ON "DailySiteUpdate"("organisationId", "projectId", "date");
CREATE UNIQUE INDEX "DailySiteUpdate_organisationId_projectId_foremanUserId_date_key" ON "DailySiteUpdate"("organisationId", "projectId", "foremanUserId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
