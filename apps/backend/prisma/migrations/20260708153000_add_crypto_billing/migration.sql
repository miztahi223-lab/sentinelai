-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "lastCryptoChargeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_lastCryptoChargeId_key" ON "subscriptions"("lastCryptoChargeId");

