-- Add missing fields to assets table
DO $$ BEGIN
  ALTER TABLE "assets" ADD COLUMN "licenseId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Safely convert networkAddresses to TEXT if it's still JSONB
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT udt_name INTO col_type FROM information_schema.columns
  WHERE table_name = 'assets' AND column_name = 'networkAddresses';
  IF col_type = 'jsonb' THEN
    ALTER TABLE "assets" ALTER COLUMN "networkAddresses" TYPE TEXT USING ("networkAddresses"::text);
  END IF;
END $$;

-- Safely convert dnsNames to TEXT if it's still JSONB
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT udt_name INTO col_type FROM information_schema.columns
  WHERE table_name = 'assets' AND column_name = 'dnsNames';
  IF col_type = 'jsonb' THEN
    ALTER TABLE "assets" ALTER COLUMN "dnsNames" TYPE TEXT USING ("dnsNames"::text);
  END IF;
END $$;

-- Add businessProcessId to risks table
DO $$ BEGIN
  ALTER TABLE "risks" ADD COLUMN "businessProcessId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Create contracts table (idempotent)
CREATE TABLE IF NOT EXISTS "contracts" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "supplierName" TEXT,
  "contractNumber" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- Create licenses table (idempotent)
CREATE TABLE IF NOT EXISTS "licenses" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "vendor" TEXT,
  "product" TEXT,
  "licenseKey" TEXT,
  "seatsTotal" INTEGER,
  "seatsUsed" INTEGER NOT NULL DEFAULT 0,
  "purchasedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- Create business_processes table (idempotent)
CREATE TABLE IF NOT EXISTS "business_processes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "owner" TEXT,
  "criticality" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_processes_pkey" PRIMARY KEY ("id")
);

-- Create asset_documents table (idempotent)
CREATE TABLE IF NOT EXISTS "asset_documents" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "assetId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "documentType" TEXT NOT NULL,
  "url" TEXT,
  "filePath" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "asset_documents_pkey" PRIMARY KEY ("id")
);

-- Create risk_evidence table (idempotent)
CREATE TABLE IF NOT EXISTS "risk_evidence" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "riskId" TEXT NOT NULL,
  "assetDocumentId" TEXT NOT NULL,
  "notes" TEXT,

  CONSTRAINT "risk_evidence_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for risk_evidence (idempotent)
DO $$ BEGIN
  CREATE UNIQUE INDEX "risk_evidence_riskId_assetDocumentId_key" ON "risk_evidence"("riskId", "assetDocumentId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create index on asset_documents.assetId (idempotent)
DO $$ BEGIN
  CREATE INDEX "asset_documents_assetId_idx" ON "asset_documents"("assetId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add foreign key constraints (idempotent)
DO $$ BEGIN
  ALTER TABLE "assets" ADD CONSTRAINT "assets_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "risks" ADD CONSTRAINT "risks_businessProcessId_fkey" FOREIGN KEY ("businessProcessId") REFERENCES "business_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "risk_evidence" ADD CONSTRAINT "risk_evidence_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "risk_evidence" ADD CONSTRAINT "risk_evidence_assetDocumentId_fkey" FOREIGN KEY ("assetDocumentId") REFERENCES "asset_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
