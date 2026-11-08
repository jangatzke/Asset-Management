-- ============================================================================
-- Item 3+8: durable e-mail deduplication, bounded-polling support and
--            ticket/user performance indexes.
--
-- PostgreSQL migration. SQL Server mirror steps are documented at the bottom of
-- this file (migrations/ is PostgreSQL-only; see the "SQL Server mirror" section).
-- All statements are additive and idempotent where the Postgres DDL allows it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. EmailMessage.dedupKey + unique index (durable dedup)
-- ---------------------------------------------------------------------------
-- `dedupKey` is always populated by the application:
--   m:<sha256(trimmed RFC 822 Message-ID)>                  (Message-ID present)
--   f:<sha256(lower(from)|lower(subject)|receivedAt ISO)>  (Message-ID absent)
-- It is nullable at the DDL level so existing rows can be backfilled below; the
-- application always writes a value. Once backfilled, the unique index makes a
-- duplicate insert impossible (Postgres treats NULLs as distinct, so legacy
-- rows without a key are not constrained until backfilled).
ALTER TABLE "email_messages" ADD COLUMN IF NOT EXISTS "dedupKey" TEXT;

-- Backfill existing rows so the unique index can be created. `digest(...)` is
-- provided by pgcrypto (sha256 is not a core function); enabling the extension
-- is idempotent and requires only the standard CREATE EXTENSION privilege.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "email_messages"
SET "dedupKey" = CASE
  WHEN "messageId" IS NOT NULL AND BTRIM("messageId") <> ''
    THEN 'm:' || encode(digest(BTRIM("messageId"), 'sha256'), 'hex')
  WHEN "messageId" IS NULL OR BTRIM("messageId") = ''
    THEN 'f:' || encode(
      digest(
        LOWER(COALESCE("fromEmail", '')) || '|' ||
        LOWER(COALESCE("subject", '')) || '|' ||
        COALESCE(to_char("receivedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), ''),
        'sha256'), 'hex')
  ELSE 'f:' || encode(digest("id", 'sha256'), 'hex')
END
WHERE "dedupKey" IS NULL;

-- Match the Prisma model (dedupKey String, required): after backfill the column
-- is non-nullable, so the unique index below is unambiguous.
ALTER TABLE "email_messages" ALTER COLUMN "dedupKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "email_messages_dedup_key_key"
  ON "email_messages" ("dedupKey");

-- Dedup lookup indexes (status filters are intentionally not added here; the
-- query is key-driven: WHERE dedupKey IN (...)).
CREATE INDEX IF NOT EXISTS "email_messages_dedupkey_receivedat_idx"
  ON "email_messages" ("dedupKey", "receivedAt");
CREATE INDEX IF NOT EXISTS "email_messages_messageid_receivedat_idx"
  ON "email_messages" ("messageId", "receivedAt");

-- NOTE: "email_messages_status_receivedAt_idx" is deliberately KEPT. It is a
-- narrow index used by status-filtered audits and by listMessages()-style
-- reads; its removal is not clearly safe, so it is retained rather than dropped.

-- ---------------------------------------------------------------------------
-- 2. User: functional index on lower(email) for resolveUserByEmail()
-- ---------------------------------------------------------------------------
-- resolveUserByEmail() runs: WHERE LOWER(email) = LOWER($1) AND isActive = true
-- A functional BTree index serves that predicate without an extra column, which
-- is the least invasive option (no write-path changes in user create/update).
CREATE INDEX IF NOT EXISTS "users_email_lower_idx"
  ON "users" (LOWER("email"));

-- ---------------------------------------------------------------------------
-- 3. Ticket: search + ordering indexes for TicketService.list()
-- ---------------------------------------------------------------------------
-- pg_trgm enables GIN acceleration for ILIKE '%needle%' (Prisma `contains` +
-- mode: 'insensitive'). displayId already carries a unique index (@unique), so
-- the trigram index on title is the meaningful addition.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "tickets_search_title_trgm_idx"
  ON "tickets" USING GIN ("title" gin_trgm_ops);

-- NOTE: the trigram index on "displayId" is optional. The unique BTree index
-- from `@unique` already covers exact lookups; `contains` searches on short
-- identifiers are cheap. It is created so case-insensitive substring searches
-- on displayId (TCKT-…) in TicketService.list() also stay bounded.
CREATE INDEX IF NOT EXISTS "tickets_search_displayid_trgm_idx"
  ON "tickets" USING GIN ("displayId" gin_trgm_ops);

-- Primary list ordering: WHERE isArchived = false ORDER BY updatedAt DESC.
-- Kept in step with the Prisma schema index @@index([isArchived, updatedAt]).
CREATE INDEX IF NOT EXISTS "tickets_isarchived_updatedat_idx"
  ON "tickets" ("isArchived", "updatedAt" DESC);

-- ---------------------------------------------------------------------------
-- SQL Server mirror (NOT executed by `prisma migrate deploy`)
-- ---------------------------------------------------------------------------
-- migrations/ is PostgreSQL-only. Apply the equivalent steps manually (or with
-- a provider-aware migration) when DB_PROVIDER=sqlserver:
--
-- 1) dedupKey column + unique index
--    ALTER TABLE "email_messages" ADD "dedupKey" NVARCHAR(MAX) NULL;
--    -- backfill with a computed SHA-256 (SQL Server 2016+):
--    UPDATE "email_messages" SET "dedupKey" =
--      'm:' + CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', LTRIM(RTRIM("messageId"))), 2)
--      -- ... same CASE structure as the Postgres backfill for the fallback arm.
--    CREATE UNIQUE INDEX "email_messages_dedup_key_key" ON "email_messages" ("dedupKey");
--    CREATE INDEX "email_messages_dedupkey_receivedat_idx" ON "email_messages" ("dedupKey", "receivedAt");
--
-- 2) User case-insensitive lookup: use a persisted computed column + index
--    (SQL Server has no functional/expression index on a plain column).
--    ALTER TABLE "users" ADD "emailLower" AS LOWER("email") PERSISTED;
--    CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" ("emailLower");
--    -- (Drop the UNIQUE constraint first if the current UNIQUE(email) is a
--    --  case-sensitive collation that conflicts; see note below.)
--
-- 3) Ticket search: SQL Server has no trigram GIN equivalent.
--    Use FULLTEXT / CONTAINS or a persisted normalized column + BTree:
--    CREATE INDEX "tickets_isarchived_updatedat_idx" ON "tickets" ("isArchived", "updatedAt" DESC);
--    -- Trigram alternative: install a CLR or use FULLTEXT
--    --   CREATE FULLTEXT INDEX ON "tickets" ("title", "displayId") KEY INDEX ...
--    -- and replace Prisma `contains` with CONTAINS/ LIKE with a computed
--    -- normalized column for case-insensitive prefix searches.
--
-- IMPORTANT: the SQL Server Prisma schema (schema.sqlserver.prisma) mirrors the
-- model changes but Prisma cannot generate functional/computed indexes from
-- the schema; those DDLs above must be applied outside Prisma. Do not convert
-- the Postgres trigram GIN indexes to plain indexes silently — SQL Server
-- cannot replicate the substring-search acceleration, so FULLTEXT is the
-- documented alternative.
