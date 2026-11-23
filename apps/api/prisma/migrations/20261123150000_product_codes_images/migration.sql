-- CreateEnum
CREATE TYPE "CodeSystem" AS ENUM ('GTIN', 'CN_ES', 'CIP13', 'CIP7', 'PZN', 'TTT_HU', 'AIM_PT', 'OTHER');

-- AlterTable
ALTER TABLE "medicines" ADD COLUMN     "imageCredit" TEXT;

-- CreateTable
CREATE TABLE "product_codes" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "packageId" TEXT,
    "system" "CodeSystem" NOT NULL,
    "code" TEXT NOT NULL,
    "countryCode" CHAR(2),
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_codes_code_idx" ON "product_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "product_codes_system_code_medicineId_key" ON "product_codes"("system", "code", "medicineId");

-- AddForeignKey
ALTER TABLE "product_codes" ADD CONSTRAINT "product_codes_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_codes" ADD CONSTRAINT "product_codes_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "medicine_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_codes" ADD CONSTRAINT "product_codes_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

