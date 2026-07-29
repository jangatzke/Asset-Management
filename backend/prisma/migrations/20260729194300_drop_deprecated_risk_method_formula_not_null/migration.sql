-- Keep the physical database compatible with the current Prisma model.
-- The legacy formula value was superseded by formulaExpression but older
-- databases can still have a NOT NULL constraint on the deprecated column.
ALTER TABLE "risk_methods" ALTER COLUMN "formula" DROP NOT NULL;
