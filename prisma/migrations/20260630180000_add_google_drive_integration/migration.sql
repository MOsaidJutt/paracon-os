-- AlterTable
ALTER TABLE "Tender" ADD COLUMN     "driveFolderId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "driveFolderId" TEXT;

-- AlterTable
ALTER TABLE "LinkedDocument" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "driveFileId" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "thumbnailLink" TEXT,
ADD COLUMN     "parentDriveFolderId" TEXT;

-- CreateTable
CREATE TABLE "GoogleDriveConnection" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "googleAccountEmail" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "rootFolderId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "connectedByUserId" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleDriveConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleDriveConnection_organisationId_key" ON "GoogleDriveConnection"("organisationId");

-- CreateIndex
CREATE INDEX "LinkedDocument_organisationId_driveFileId_idx" ON "LinkedDocument"("organisationId", "driveFileId");

-- AddForeignKey
ALTER TABLE "GoogleDriveConnection" ADD CONSTRAINT "GoogleDriveConnection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleDriveConnection" ADD CONSTRAINT "GoogleDriveConnection_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
