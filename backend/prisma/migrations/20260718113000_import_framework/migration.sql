-- Generic Import Framework (Paket 2.3)

CREATE TABLE "integration_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "integration_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_runs" (
    "id" TEXT NOT NULL,
    "integrationSourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "statistics" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "createdBy" TEXT,
    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_records" (
    "id" TEXT NOT NULL,
    "importRunId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceData" JSONB NOT NULL,
    "targetAssetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "action" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_conflicts" (
    "id" TEXT NOT NULL,
    "importRunId" TEXT NOT NULL,
    "importRecordId" TEXT,
    "assetId" TEXT,
    "fieldName" TEXT NOT NULL,
    "existingValue" JSONB,
    "incomingValue" JSONB,
    "winningValue" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_conflicts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_provenance" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "integrationSourceId" TEXT NOT NULL,
    "importRunId" TEXT,
    "sourceRecordId" TEXT,
    "value" JSONB,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setBy" TEXT,
    CONSTRAINT "field_provenance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_locks" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "reason" TEXT,
    "lockedBy" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "field_locks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "source_priorities" (
    "id" TEXT NOT NULL,
    "integrationSourceId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "source_priorities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_sources_name_key" ON "integration_sources"("name");
CREATE INDEX "integration_sources_type_idx" ON "integration_sources"("type");
CREATE INDEX "integration_sources_isActive_idx" ON "integration_sources"("isActive");
CREATE INDEX "import_runs_integrationSourceId_idx" ON "import_runs"("integrationSourceId");
CREATE INDEX "import_runs_status_idx" ON "import_runs"("status");
CREATE INDEX "import_runs_startedAt_idx" ON "import_runs"("startedAt");
CREATE UNIQUE INDEX "import_records_importRunId_sourceRecordId_key" ON "import_records"("importRunId", "sourceRecordId");
CREATE INDEX "import_records_targetAssetId_idx" ON "import_records"("targetAssetId");
CREATE INDEX "import_records_status_idx" ON "import_records"("status");
CREATE INDEX "import_conflicts_importRunId_idx" ON "import_conflicts"("importRunId");
CREATE INDEX "import_conflicts_assetId_idx" ON "import_conflicts"("assetId");
CREATE INDEX "import_conflicts_status_idx" ON "import_conflicts"("status");
CREATE UNIQUE INDEX "field_provenance_assetId_fieldName_key" ON "field_provenance"("assetId", "fieldName");
CREATE INDEX "field_provenance_integrationSourceId_idx" ON "field_provenance"("integrationSourceId");
CREATE INDEX "field_provenance_importRunId_idx" ON "field_provenance"("importRunId");
CREATE UNIQUE INDEX "field_locks_assetId_fieldName_key" ON "field_locks"("assetId", "fieldName");
CREATE INDEX "field_locks_assetId_idx" ON "field_locks"("assetId");
CREATE INDEX "field_locks_isActive_idx" ON "field_locks"("isActive");
CREATE UNIQUE INDEX "source_priorities_integrationSourceId_fieldName_key" ON "source_priorities"("integrationSourceId", "fieldName");
CREATE INDEX "source_priorities_fieldName_priority_idx" ON "source_priorities"("fieldName", "priority");

ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_integrationSourceId_fkey" FOREIGN KEY ("integrationSourceId") REFERENCES "integration_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_records" ADD CONSTRAINT "import_records_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_records" ADD CONSTRAINT "import_records_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "import_conflicts" ADD CONSTRAINT "import_conflicts_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_conflicts" ADD CONSTRAINT "import_conflicts_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "import_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_integrationSourceId_fkey" FOREIGN KEY ("integrationSourceId") REFERENCES "integration_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_locks" ADD CONSTRAINT "field_locks_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_priorities" ADD CONSTRAINT "source_priorities_integrationSourceId_fkey" FOREIGN KEY ("integrationSourceId") REFERENCES "integration_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
