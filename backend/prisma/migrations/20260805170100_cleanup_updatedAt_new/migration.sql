-- Clean up stray updatedAt_new column that was accidentally added during earlier migration attempt
DO $$ BEGIN
    ALTER TABLE "webhooks" DROP COLUMN "updatedAt_new";
EXCEPTION
    WHEN undefined_column THEN NULL;
END $$;
