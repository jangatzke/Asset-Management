-- IntuneDetectedApp: Add composite unique constraint on [intuneAppId, deviceId]
-- This ensures each app is unique per device, not globally

-- Drop the old index on intuneAppId (will be recreated)
DROP INDEX IF EXISTS "Prisma.intune_detected_apps_intuneAppId_idx";

-- Recreate the unique constraint and index
ALTER TABLE "intune_detected_apps" ADD CONSTRAINT "intune_detected_apps_intuneAppId_deviceId_key" UNIQUE("intuneAppId", "deviceId");
