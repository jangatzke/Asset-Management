-- Add quoteNumber (Angebotsnummer) and remark (Bemerkung) columns to cost_plan_items table
ALTER TABLE "cost_plan_items"
  ADD COLUMN IF NOT EXISTS "quoteNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "remark" TEXT;
