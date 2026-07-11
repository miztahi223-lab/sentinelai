-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "slackWebhookUrl" TEXT,
    "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_organizationId_key" ON "notification_settings"("organizationId");

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
