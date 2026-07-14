-- Worker: supplementary name fields (Chinese name, alias) and a free-text
-- notes field. All nullable, no data backfill needed — "name" stays the
-- single primary/legal name every existing query already reads.
ALTER TABLE "Worker" ADD COLUMN "chineseName" TEXT;
ALTER TABLE "Worker" ADD COLUMN "alias" TEXT;
ALTER TABLE "Worker" ADD COLUMN "notes" TEXT;

-- SupplierPerformance: same four-dimension rating as WorkerPerformance, so
-- subcontracting companies can be rated the same way individual workers are.
CREATE TABLE "SupplierPerformance" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "quality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reliability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productivity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "safety" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPerformance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierPerformance_supplierId_key" ON "SupplierPerformance"("supplierId");

ALTER TABLE "SupplierPerformance" ADD CONSTRAINT "SupplierPerformance_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
