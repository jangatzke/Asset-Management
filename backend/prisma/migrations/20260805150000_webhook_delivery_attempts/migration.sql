-- CreateEnum
CREATE TYPE "WebhookDeliveryAttemptStatus" AS ENUM ('pending', 'delivering', 'success', 'failed', 'expired');

-- AlterTable (conditionally drop constraint if it exists)
DO $$ BEGIN
    ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "webhook_deliveries_eventId_key";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "webhook_delivery_attempts" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "eventPayloadId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "WebhookDeliveryAttemptStatus" NOT NULL,
    "errorMessage" TEXT,
    "responseStatus" INTEGER,
    "responseHeaders" TEXT,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_delivery_attempts_deliveryId_idx" ON "webhook_delivery_attempts"("deliveryId");

-- CreateIndex
CREATE INDEX "webhook_delivery_attempts_webhookId_status_idx" ON "webhook_delivery_attempts"("webhookId", "status");

-- AddForeignKey
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "webhook_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
