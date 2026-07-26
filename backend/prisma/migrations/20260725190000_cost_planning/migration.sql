CREATE TABLE IF NOT EXISTS "fiscal_year_configs" (
  "id" TEXT NOT NULL,
  "startMonth" INTEGER NOT NULL DEFAULT 1,
  "startDay" INTEGER NOT NULL DEFAULT 1,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fiscal_year_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cost_plans" (
  "id" TEXT NOT NULL,
  "displayId" TEXT NOT NULL,
  "fiscalYearLabel" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "notes" TEXT,
  "ownerUserId" TEXT,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  CONSTRAINT "cost_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cost_plan_items" (
  "id" TEXT NOT NULL,
  "displayId" TEXT NOT NULL,
  "costPlanId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceKey" TEXT,
  "sourceAssetId" TEXT,
  "sourceLicenseId" TEXT,
  "sourceContractId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "investmentType" TEXT NOT NULL,
  "relevanceReason" TEXT,
  "plannedAmount" DECIMAL(65,30) NOT NULL,
  "knownAmount" DECIMAL(65,30),
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "plannedDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'planned',
  "supplierId" TEXT,
  "supplierName" TEXT,
  "invoiceNumber" TEXT,
  "invoiceDate" TIMESTAMP(3),
  "acquiredAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  CONSTRAINT "cost_plan_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cost_plans_displayId_key" ON "cost_plans"("displayId");
CREATE UNIQUE INDEX IF NOT EXISTS "cost_plans_fiscalYearLabel_key" ON "cost_plans"("fiscalYearLabel");
CREATE INDEX IF NOT EXISTS "cost_plans_periodStart_periodEnd_idx" ON "cost_plans"("periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "cost_plans_status_idx" ON "cost_plans"("status");
CREATE INDEX IF NOT EXISTS "cost_plans_ownerUserId_idx" ON "cost_plans"("ownerUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "cost_plan_items_displayId_key" ON "cost_plan_items"("displayId");
CREATE UNIQUE INDEX IF NOT EXISTS "cost_plan_items_costPlanId_sourceKey_key" ON "cost_plan_items"("costPlanId", "sourceKey");
CREATE INDEX IF NOT EXISTS "cost_plan_items_costPlanId_status_idx" ON "cost_plan_items"("costPlanId", "status");
CREATE INDEX IF NOT EXISTS "cost_plan_items_category_idx" ON "cost_plan_items"("category");
CREATE INDEX IF NOT EXISTS "cost_plan_items_sourceType_idx" ON "cost_plan_items"("sourceType");
CREATE INDEX IF NOT EXISTS "cost_plan_items_plannedDate_idx" ON "cost_plan_items"("plannedDate");
CREATE INDEX IF NOT EXISTS "cost_plan_items_dueDate_idx" ON "cost_plan_items"("dueDate");
CREATE INDEX IF NOT EXISTS "cost_plan_items_sourceAssetId_idx" ON "cost_plan_items"("sourceAssetId");
CREATE INDEX IF NOT EXISTS "cost_plan_items_sourceLicenseId_idx" ON "cost_plan_items"("sourceLicenseId");
CREATE INDEX IF NOT EXISTS "cost_plan_items_sourceContractId_idx" ON "cost_plan_items"("sourceContractId");

ALTER TABLE "fiscal_year_configs" ADD CONSTRAINT "fiscal_year_configs_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_plans" ADD CONSTRAINT "cost_plans_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_plan_items" ADD CONSTRAINT "cost_plan_items_costPlanId_fkey" FOREIGN KEY ("costPlanId") REFERENCES "cost_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cost_plan_items" ADD CONSTRAINT "cost_plan_items_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_plan_items" ADD CONSTRAINT "cost_plan_items_sourceLicenseId_fkey" FOREIGN KEY ("sourceLicenseId") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_plan_items" ADD CONSTRAINT "cost_plan_items_sourceContractId_fkey" FOREIGN KEY ("sourceContractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_plan_items" ADD CONSTRAINT "cost_plan_items_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "fiscal_year_configs" ("id", "startMonth", "startDay", "timezone", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 1, 1, 'Europe/Berlin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "fiscal_year_configs");

UPDATE "roles"
SET "entityPermissions" = jsonb_set(COALESCE("entityPermissions"::jsonb, '{}'::jsonb), '{costPlanning}', '"readwrite"'::jsonb, true)
WHERE "name" = 'system_admin';

UPDATE "roles"
SET "entityPermissions" = jsonb_set(COALESCE("entityPermissions"::jsonb, '{}'::jsonb), '{costPlanning}', '"readonly"'::jsonb, true)
WHERE "name" = 'employee';
