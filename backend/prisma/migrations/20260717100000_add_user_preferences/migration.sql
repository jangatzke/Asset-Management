-- Add language and darkMode columns to users table
ALTER TABLE "users" ADD COLUMN "language" VARCHAR(255) DEFAULT 'en';
ALTER TABLE "users" ADD COLUMN "darkMode" BOOLEAN;
