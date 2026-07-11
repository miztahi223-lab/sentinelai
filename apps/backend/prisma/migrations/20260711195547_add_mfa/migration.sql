-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfaBackupCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaSecret" TEXT;
