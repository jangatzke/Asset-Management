-- Reuse the existing supplier-management domain for cost-plan procurement items.
-- supplierName remains as a legacy snapshot for existing integrations and exports.
ALTER TABLE "cost_plan_items"
  ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

CREATE INDEX IF NOT EXISTS "cost_plan_items_supplierId_idx"
  ON "cost_plan_items"("supplierId");

ALTER TABLE "cost_plan_items"
  DROP CONSTRAINT IF EXISTS "cost_plan_items_supplierId_fkey";

ALTER TABLE "cost_plan_items"
  ADD CONSTRAINT "cost_plan_items_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Safe, conservative backfill: only names with exactly one active supplier match
-- are linked. Ambiguous and historical names retain their legacy supplierName.
UPDATE "cost_plan_items" AS item
SET "supplierId" = matches."id"
FROM (
  SELECT "legalName", MIN("id") AS "id"
  FROM "suppliers"
  WHERE "isArchived" = false
  GROUP BY "legalName"
  HAVING COUNT(*) = 1
) AS matches
WHERE item."supplierId" IS NULL
  AND item."supplierName" IS NOT NULL
  AND lower(btrim(item."supplierName")) = lower(btrim(matches."legalName"));
