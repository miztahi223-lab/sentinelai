-- AlterEnum
ALTER TYPE "AssetType" ADD VALUE 'DNS';

-- AlterTable
ALTER TABLE "findings" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;
