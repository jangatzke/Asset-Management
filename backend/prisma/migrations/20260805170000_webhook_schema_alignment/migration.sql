-- Create missing enum types
CREATE TYPE "WebhookStatus" AS ENUM ('active', 'paused', 'archived');
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('pending', 'delivering', 'success', 'failed', 'expired');

-- ============================================================
-- webhooks table alignment
-- ============================================================

-- Add missing `status` column (WebhookStatus enum)
ALTER TABLE "webhooks" ADD COLUMN "status" "WebhookStatus" NOT NULL DEFAULT 'active';

-- Fix `events` column: convert from JSONB to TEXT array representation
-- Step 1: Add new events column as TEXT
ALTER TABLE "webhooks" ADD COLUMN "events_new" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Step 2: Migrate data from JSONB to TEXT array
-- Convert JSONB array to TEXT array (each element becomes a text item)
UPDATE "webhooks" SET "events_new" = ARRAY(SELECT jsonb_array_elements_text("events")) WHERE "events"::text != '[]' AND "events" IS NOT NULL;

-- Step 3: Drop old JSONB events column
ALTER TABLE "webhooks" DROP COLUMN "events";

-- Step 4: Rename new events column to events
ALTER TABLE "webhooks" RENAME COLUMN "events_new" TO "events";

-- Fix `maxRetries` default: change from 3 to 5
ALTER TABLE "webhooks" ALTER COLUMN "maxRetries" SET DEFAULT 5;

-- Add composite index on [status, isActive]
CREATE INDEX IF NOT EXISTS "webhooks_status_isActive_idx" ON "webhooks"("status", "isActive");

-- ============================================================
-- webhook_deliveries table alignment
-- ============================================================

-- Add missing `eventType` column
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "eventType" TEXT;

-- Add missing `payload` column (TEXT)
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "payload" TEXT;

-- Add missing `signature` column (nullable)
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "signature" TEXT;

-- Add missing `status` column (WebhookDeliveryStatus enum)
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'pending';

-- Add missing `updatedAt` column
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Fix `requestHeaders`: convert from JSONB to TEXT
-- Step 1: Add new requestHeaders column as TEXT
ALTER TABLE "webhook_deliveries" ADD COLUMN "requestHeaders_new" TEXT NOT NULL DEFAULT '{}';

-- Step 2: Migrate data from JSONB to TEXT (keep as JSON string)
UPDATE "webhook_deliveries" SET "requestHeaders_new" = "requestHeaders"::TEXT WHERE "requestHeaders" IS NOT NULL;

-- Step 3: Drop old JSONB requestHeaders column
ALTER TABLE "webhook_deliveries" DROP COLUMN "requestHeaders";

-- Step 4: Rename new column to requestHeaders
ALTER TABLE "webhook_deliveries" RENAME COLUMN "requestHeaders_new" TO "requestHeaders";

-- Fix `responseHeaders`: convert from JSONB to TEXT (nullable)
-- Step 1: Add new responseHeaders column as TEXT nullable
ALTER TABLE "webhook_deliveries" ADD COLUMN "responseHeaders_new" TEXT;

-- Step 2: Migrate data from JSONB to TEXT
UPDATE "webhook_deliveries" SET "responseHeaders_new" = "responseHeaders"::TEXT WHERE "responseHeaders" IS NOT NULL;

-- Step 3: Drop old JSONB responseHeaders column
ALTER TABLE "webhook_deliveries" DROP COLUMN "responseHeaders";

-- Step 4: Rename new column to responseHeaders
ALTER TABLE "webhook_deliveries" RENAME COLUMN "responseHeaders_new" TO "responseHeaders";

-- Fix `requestBodyHash`: change from NOT NULL to nullable
ALTER TABLE "webhook_deliveries" ALTER COLUMN "requestBodyHash" DROP NOT NULL;
ALTER TABLE "webhook_deliveries" ALTER COLUMN "requestBodyHash" SET DEFAULT NULL;

-- ============================================================
-- webhook_delivery_attempts table alignment
-- ============================================================

-- Fix `durationMs`: ensure nullable
ALTER TABLE "webhook_delivery_attempts" ALTER COLUMN "durationMs" DROP NOT NULL;

-- Fix `responseStatus`: ensure nullable
ALTER TABLE "webhook_delivery_attempts" ALTER COLUMN "responseStatus" DROP NOT NULL;

-- Fix `responseHeaders`: ensure nullable
ALTER TABLE "webhook_delivery_attempts" ALTER COLUMN "responseHeaders" DROP NOT NULL;

-- ============================================================
-- Missing indexes and constraints for webhook_deliveries
-- ============================================================

-- Index on [status]
CREATE INDEX IF NOT EXISTS "webhook_deliveries_status_idx" ON "webhook_deliveries"("status");

-- Composite index on [webhookId, status]
CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhookId_status_idx" ON "webhook_deliveries"("webhookId", "status");

-- Unique constraint on [webhookId, eventId, attemptNumber]
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhookId_eventId_attemptNumber_key" UNIQUE("webhookId", "eventId", "attemptNumber");
