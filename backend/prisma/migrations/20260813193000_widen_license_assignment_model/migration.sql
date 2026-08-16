-- Widen "assignmentModel" to fit 'concurrent' (10 chars); original VARCHAR(8) only fit 'named'
ALTER TABLE "licenses" ALTER COLUMN "assignmentModel" TYPE VARCHAR(16);
