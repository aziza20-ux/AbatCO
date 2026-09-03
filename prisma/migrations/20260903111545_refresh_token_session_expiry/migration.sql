-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN "sessionExpiresAt" TIMESTAMP(3);

-- Backfill existing rows: treat their current expiresAt as the session ceiling
UPDATE "RefreshToken" SET "sessionExpiresAt" = "expiresAt" WHERE "sessionExpiresAt" IS NULL;

-- Make non-nullable now that all rows are filled
ALTER TABLE "RefreshToken" ALTER COLUMN "sessionExpiresAt" SET NOT NULL;
