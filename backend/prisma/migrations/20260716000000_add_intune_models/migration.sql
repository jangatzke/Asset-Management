-- Intune Integration Models Migration

-- Intune Device Sync table
CREATE TABLE "intune_device_syncs" (
    "id" TEXT NOT NULL,
    "intuneId" TEXT NOT NULL,
    "name" TEXT,
    "serialNumber" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "osName" TEXT,
    "osVersion" TEXT,
    "deviceEnrollmentType" TEXT,
    "managementType" TEXT,
    "complianceStatus" TEXT,
    "deviceState" TEXT,
    "enrollmentDateTime" TIMESTAMPTZ,
    "lastSyncDateTime" TIMESTAMPTZ,
    "primaryUserEmail" TEXT,
    "primaryUserDisplayName" TEXT,
    "endpointSecurityStatus" JSONB,
    "malwareStatus" JSONB,
    "compliancePolicyName" TEXT,
    "configurationPolicyName" TEXT,
    "autopilotStatus" TEXT,
    "autopilotProfileName" TEXT,
    "lastSeenDateTime" TIMESTAMPTZ,
    "intuneLicenseState" TEXT,
    "deviceWpdsStatus" TEXT,
    "syncStatus" TEXT DEFAULT 'pending',
    "syncErrorMessage" TEXT,
    "syncAttempts" INTEGER DEFAULT 0,
    "lastSyncAt" TIMESTAMPTZ,
    "assetId" TEXT,
    "sourceIntuneId" TEXT,
    "sourceUpdatedAt" TIMESTAMPTZ,
    "isArchived" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "intune_device_syncs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intune_device_syncs_intuneId_key" ON "intune_device_syncs"("intuneId");
CREATE INDEX "intune_device_syncs_syncStatus_idx" ON "intune_device_syncs"("syncStatus");
CREATE INDEX "intune_device_syncs_lastSyncDateTime_idx" ON "intune_device_syncs"("lastSyncDateTime");

-- Intune Detected Apps table
CREATE TABLE "intune_detected_apps" (
    "id" TEXT NOT NULL,
    "intuneAppId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT,
    "version" TEXT,
    "publisher" TEXT,
    "platform" TEXT,
    "appCategory" TEXT,
    "isManaged" BOOLEAN DEFAULT FALSE,
    "syncStatus" TEXT DEFAULT 'pending',
    "syncErrorMessage" TEXT,
    "syncAttempts" INTEGER DEFAULT 0,
    "lastSyncAt" TIMESTAMPTZ,
    "sourceIntuneId" TEXT,
    "sourceUpdatedAt" TIMESTAMPTZ,
    "isArchived" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "intune_detected_apps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "intune_detected_apps_intuneAppId_idx" ON "intune_detected_apps"("intuneAppId");
CREATE INDEX "intune_detected_apps_deviceId_idx" ON "intune_detected_apps"("deviceId");

-- Intune Sync Status table
CREATE TABLE "intune_sync_status" (
    "id" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT DEFAULT 'idle',
    "deviceCount" INTEGER DEFAULT 0,
    "deviceSynced" INTEGER DEFAULT 0,
    "deviceErrors" INTEGER DEFAULT 0,
    "appCount" INTEGER DEFAULT 0,
    "appSynced" INTEGER DEFAULT 0,
    "appErrors" INTEGER DEFAULT 0,
    "lastSyncStartedAt" TIMESTAMPTZ,
    "lastSyncCompletedAt" TIMESTAMPTZ,
    "lastSyncDurationMs" INTEGER,
    "lastError" TEXT,
    "totalSyncs" INTEGER DEFAULT 0,
    "totalDevicesSynced" INTEGER DEFAULT 0,
    "totalDevicesErrors" INTEGER DEFAULT 0,
    "healthStatus" TEXT DEFAULT 'healthy',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "intune_sync_status_pkey" PRIMARY KEY ("id")
);

-- Intune Sync Config table
CREATE TABLE "intune_sync_config" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN DEFAULT FALSE,
    "fullSyncIntervalHours" INTEGER DEFAULT 24,
    "incrementalSyncIntervalMinutes" INTEGER DEFAULT 120,
    "gracePeriodHours" INTEGER DEFAULT 168,
    "maxRetryAttempts" INTEGER DEFAULT 3,
    "retryDelayMs" INTEGER DEFAULT 5000,
    "batchSize" INTEGER DEFAULT 100,
    "lastFullSyncAt" TIMESTAMPTZ,
    "lastIncrementalSyncAt" TIMESTAMPTZ,
    "nextFullSyncAt" TIMESTAMPTZ,
    "nextIncrementalSyncAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "intune_sync_config_pkey" PRIMARY KEY ("id")
);

-- Seed default sync config
INSERT INTO "intune_sync_config" ("id", "enabled", "fullSyncIntervalHours", "incrementalSyncIntervalMinutes", "gracePeriodHours", "maxRetryAttempts", "retryDelayMs", "batchSize")
VALUES (gen_random_uuid(), FALSE, 24, 120, 168, 3, 5000, 100);

-- Seed default sync status
INSERT INTO "intune_sync_status" ("id", "syncType", "status", "healthStatus")
VALUES (gen_random_uuid(), 'full', 'idle', 'healthy');
