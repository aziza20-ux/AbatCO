-- CreateEnum
CREATE TYPE "OwnershipStatus" AS ENUM ('ACTIVE', 'HISTORICAL');

-- AlterTable: add column defaulting to ACTIVE (safe for existing rows)
ALTER TABLE "Transaction" ADD COLUMN "ownershipStatus" "OwnershipStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill: mark all but the latest transaction per bicycle as HISTORICAL.
-- The latest is determined by transactionDate DESC, then createdAt DESC as tiebreaker.
UPDATE "Transaction" t
SET "ownershipStatus" = 'HISTORICAL'
WHERE t.id NOT IN (
  SELECT DISTINCT ON ("bicycleId") id
  FROM "Transaction"
  ORDER BY "bicycleId", "transactionDate" DESC, "createdAt" DESC
);

-- Index for efficient active-transaction lookups per bicycle
CREATE INDEX "Transaction_bicycleId_ownershipStatus_idx" ON "Transaction"("bicycleId", "ownershipStatus");
