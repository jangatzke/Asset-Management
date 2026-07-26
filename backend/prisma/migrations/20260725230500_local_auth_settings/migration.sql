-- Persist configurable authentication settings for local users only.
CREATE TABLE IF NOT EXISTS "auth_settings" (
    "id" TEXT NOT NULL,
    "passwordComplexityEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minPasswordLength" INTEGER NOT NULL DEFAULT 12,
    "passwordHistoryCount" INTEGER NOT NULL DEFAULT 0,
    "passwordValidityDays" INTEGER NOT NULL DEFAULT 0,
    "forceMfa" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    CONSTRAINT "auth_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "password_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "password_history_userId_createdAt_idx" ON "password_history"("userId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'password_history_userId_fkey'
    ) THEN
        ALTER TABLE "password_history"
        ADD CONSTRAINT "password_history_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

