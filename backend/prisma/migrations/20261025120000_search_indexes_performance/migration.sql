-- Performance package: trigram GIN indexes for the global search (ILIKE '%…%')
-- plus BTree indexes on hot filter/sort paths that were missing.

-- pg_trgm enables fast case-insensitive substring matching via GIN.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Global search: contains-any-of-fields queries run as ILIKE '%needle%'.
-- Without trigram indexes every category does a sequential scan per keystroke.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "assets_search_name_trgm_idx"
  ON "assets" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "assets_search_description_trgm_idx"
  ON "assets" USING GIN ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "assets_search_serial_trgm_idx"
  ON "assets" USING GIN ("serialNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "tickets_search_title_trgm_idx"
  ON "tickets" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "tickets_search_description_trgm_idx"
  ON "tickets" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "incidents_search_title_trgm_idx"
  ON "incidents" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "incidents_search_description_trgm_idx"
  ON "incidents" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "risks_search_title_trgm_idx"
  ON "risks" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "risks_search_description_trgm_idx"
  ON "risks" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "controls_search_title_trgm_idx"
  ON "controls" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "controls_search_description_trgm_idx"
  ON "controls" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "contracts_search_title_trgm_idx"
  ON "contracts" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "contracts_search_description_trgm_idx"
  ON "contracts" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "licenses_search_title_trgm_idx"
  ON "licenses" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "licenses_search_description_trgm_idx"
  ON "licenses" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "suppliers_search_legalname_trgm_idx"
  ON "suppliers" USING GIN ("legalName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "suppliers_search_description_trgm_idx"
  ON "suppliers" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "knowledge_articles_search_title_trgm_idx"
  ON "knowledge_articles" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "knowledge_articles_search_content_trgm_idx"
  ON "knowledge_articles" USING GIN ("content" gin_trgm_ops);

-- NOTE: displayId columns already carry unique indexes via the Prisma schema
-- (@unique); no additional index is needed for exact identifier lookups.

-- ---------------------------------------------------------------------------
-- Missing BTree indexes on hot list paths (search + sort by updatedAt desc).
-- The search service orders every category by updated_at; without an index the
-- planner must sort the full candidate set.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "assets_isarchived_updatedat_idx"
  ON "assets" ("isArchived", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "tickets_isarchived_updatedat_idx"
  ON "tickets" ("isArchived", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "incidents_isarchived_updatedat_idx"
  ON "incidents" ("isArchived", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "risks_isarchived_updatedat_idx"
  ON "risks" ("isArchived", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "controls_isarchived_updatedat_idx"
  ON "controls" ("isArchived", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "contracts_isarchived_updatedat_idx"
  ON "contracts" ("isArchived", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "licenses_isarchived_updatedat_idx"
  ON "licenses" ("isArchived", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "suppliers_isarchived_updatedat_idx"
  ON "suppliers" ("isArchived", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "knowledge_articles_isarchived_updatedat_idx"
  ON "knowledge_articles" ("isArchived", "updatedAt" DESC);

-- Foreign-key lookups used by the scoped authorization filters (assets are the
-- most common join target for ticket/incident/asset scope checks).
CREATE INDEX IF NOT EXISTS "assets_organizationunitid_idx"
  ON "assets" ("organizationUnitId");
CREATE INDEX IF NOT EXISTS "assets_locationid_idx"
  ON "assets" ("locationId");
