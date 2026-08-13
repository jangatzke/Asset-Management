-- Add licensing_basis and assignment_model columns with defaults for backward compatibility
ALTER TABLE "licenses" ADD COLUMN "licensingBasis" VARCHAR(8) NOT NULL DEFAULT 'user';
ALTER TABLE "licenses" ADD COLUMN "assignmentModel" VARCHAR(8) NOT NULL DEFAULT 'named';

-- Backfill existing rows: user+named is the safest default for existing licenses
UPDATE "licenses" SET "licensingBasis" = 'user' WHERE "licensingBasis" IS NULL OR "licensingBasis" = '';
UPDATE "licenses" SET "assignmentModel" = 'named' WHERE "assignmentModel" IS NULL OR "assignmentModel" = '';
