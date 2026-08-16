/**
 * Regression test for the corrective_actions.displayId collision repair migration.
 *
 * Validates that the migration:
 *   - Adds the displayId column if missing
 *   - Backfills legacy rows with unique CAPA-XXXX values
 *   - Enforces NOT NULL and unique constraints
 *   - Preserves existing CAPA records that already have displayId
 *   - Does not break Action Center CAPA querying
 *
 * Uses an isolated schema in the supplied PostgreSQL database.
 * Opt-in: skipped when no MIGRATION_TEST_DATABASE_URL or psql is unavailable.
 */

import { execFileSync } from 'child_process';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../prisma/migrations/20260816151000_fix_corrective_action_displayid_collisions/migration.sql',
);

const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;

const canUsePsql = (): boolean => {
  try {
    execFileSync('psql', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const runSql = (url: string, sql: string): string =>
  execFileSync(
    'psql',
    [
      url,
      '--set',
      'ON_ERROR_STOP=1',
      '--no-align',
      '--tuples-only',
      '--quiet',
      '--no-psqlrc',
      '--command',
      sql,
    ],
    { encoding: 'utf8', stdio: 'pipe' },
  ).trim();

describe('corrective_actions.displayId collision repair migration', () => {
  const runIfDatabaseAvailable = databaseUrl && canUsePsql() ? it : it.skip;

  const createSchema = (schemaName: string, url: string) =>
    runSql(url, `CREATE SCHEMA "${schemaName}"; SET search_path TO "${schemaName}";`);

  const dropSchema = (schemaName: string, url: string) =>
    runSql(url, `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);

  const setSearchPath = (schemaName: string, url: string) =>
    runSql(url, `SET search_path TO "${schemaName}";`);

  runIfDatabaseAvailable(
    'adds displayId column when missing and backfills legacy rows with unique CAPA-XXXX values',
    () => {
      const schemaName = `capa_displayid_repair_${Date.now()}_${process.pid}`.replace(/[^a-zA-Z0-9_]/g, '_');

      try {
        createSchema(schemaName, databaseUrl!);
        setSearchPath(schemaName, databaseUrl!);

        // Simulate legacy table WITHOUT displayId column
        runSql(
          databaseUrl!,
          `SET search_path TO "${schemaName}"; CREATE TABLE "corrective_actions" (
            "id" TEXT PRIMARY KEY,
            "title" TEXT NOT NULL DEFAULT 'Legacy CAPA',
            "description" TEXT NOT NULL DEFAULT '',
            "sourceType" TEXT NOT NULL DEFAULT 'audit',
            "sourceId" TEXT,
            "ownerId" TEXT NOT NULL DEFAULT 'owner-1',
            "dueDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
            "priority" TEXT NOT NULL DEFAULT 'medium',
            "status" TEXT NOT NULL DEFAULT 'open',
            "version" TEXT NOT NULL DEFAULT '1.0.0',
            "isArchived" BOOLEAN NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
          );`,
        );

        // Insert legacy rows without displayId
        runSql(
          databaseUrl!,
          `SET search_path TO "${schemaName}";
           INSERT INTO "corrective_actions" ("id", "title") VALUES ('capa-old-1', 'Legacy CAPA 1');
           INSERT INTO "corrective_actions" ("id", "title") VALUES ('capa-old-2', 'Legacy CAPA 2');
           INSERT INTO "corrective_actions" ("id", "title") VALUES ('capa-old-3', 'Legacy CAPA 3');`,
        );

        // Run migration twice to verify idempotency
        for (let attempt = 0; attempt < 2; attempt += 1) {
          execFileSync(
            'psql',
            [
              databaseUrl!,
              '--set',
              'ON_ERROR_STOP=1',
              '--quiet',
              '--no-psqlrc',
              '--command',
              `SET search_path TO "${schemaName}";`,
              '--file',
              migrationPath,
            ],
            { encoding: 'utf8', stdio: 'pipe' },
          );
        }

        // Verify column exists and is NOT NULL
        const columnInfo = JSON.parse(
          runSql(databaseUrl!, `
            SET search_path TO "${schemaName}";
            SELECT json_build_object(
              'notNull', (SELECT is_nullable = 'NO' FROM information_schema.columns WHERE table_schema = '${schemaName}' AND table_name = 'corrective_actions' AND column_name = 'displayId')
            )::text;
          `),
        ) as { notNull: boolean };

        expect(columnInfo.notNull).toBe(true);

        // Verify all rows have displayId
        const backfillResult = JSON.parse(
          runSql(databaseUrl!, `
            SET search_path TO "${schemaName}";
            SELECT json_build_object(
              'totalCount', count(*),
              'nullCount', count(*) FILTER (WHERE "displayId" IS NULL),
              'emptyCount', count(*) FILTER (WHERE "displayId" = ''),
              'uniqueCount', count(DISTINCT "displayId")
            )::text
            FROM "corrective_actions";
          `),
        ) as { totalCount: number; nullCount: number; emptyCount: number; uniqueCount: number };

        expect(backfillResult.totalCount).toBe(3);
        expect(backfillResult.nullCount).toBe(0);
        expect(backfillResult.emptyCount).toBe(0);
        expect(backfillResult.uniqueCount).toBe(3);

        // Verify displayId format matches CAPA-XXXX pattern
        const formatResult = JSON.parse(
          runSql(databaseUrl!, `
            SET search_path TO "${schemaName}";
            SELECT json_agg("displayId" ORDER BY "displayId") FROM "corrective_actions";
          `),
        ) as string[];

        for (const id of formatResult) {
          expect(id).toMatch(/^CAPA-\d{4}$/);
        }
      } finally {
        dropSchema(schemaName, databaseUrl!);
      }
    },
  );

  runIfDatabaseAvailable(
    'preserves existing displayId values and backfills only NULL rows',
    () => {
      const schemaName = `capa_displayid_preserve_${Date.now()}_${process.pid}`.replace(/[^a-zA-Z0-9_]/g, '_');

      try {
        createSchema(schemaName, databaseUrl!);
        setSearchPath(schemaName, databaseUrl!);

        // Create table WITH displayId column already present (partial migration state)
        runSql(
          databaseUrl!,
          `SET search_path TO "${schemaName}"; CREATE TABLE "corrective_actions" (
            "id" TEXT PRIMARY KEY,
            "displayId" TEXT,
            "title" TEXT NOT NULL DEFAULT 'CAPA',
            "sourceType" TEXT NOT NULL DEFAULT 'audit',
            "ownerId" TEXT NOT NULL DEFAULT 'owner-1',
            "dueDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
            "status" TEXT NOT NULL DEFAULT 'open',
            "version" TEXT NOT NULL DEFAULT '1.0.0'
          );`,
        );

        // Insert a mix: some with displayId, some without
        runSql(
          databaseUrl!,
          `SET search_path TO "${schemaName}";
           INSERT INTO "corrective_actions" ("id", "displayId", "title") VALUES ('capa-existing', 'CAPA-EXISTING', 'Preserved CAPA');
           INSERT INTO "corrective_actions" ("id", "displayId", "title") VALUES ('capa-null-1', NULL, 'Null CAPA 1');
           INSERT INTO "corrective_actions" ("id", "displayId", "title") VALUES ('capa-null-2', NULL, 'Null CAPA 2');`,
        );

        // Run migration
        execFileSync(
          'psql',
          [
            databaseUrl!,
            '--set',
            'ON_ERROR_STOP=1',
            '--quiet',
            '--no-psqlrc',
            '--command',
            `SET search_path TO "${schemaName}";`,
            '--file',
            migrationPath,
          ],
          { encoding: 'utf8', stdio: 'pipe' },
        );

        // Verify existing displayId is preserved
        const preserveResult = JSON.parse(
          runSql(databaseUrl!, `
            SET search_path TO "${schemaName}";
            SELECT json_build_object(
              'existingPreserved', "displayId" = 'CAPA-EXISTING'
            )::text
            FROM "corrective_actions"
            WHERE "id" = 'capa-existing';
          `),
        ) as { existingPreserved: boolean };

        expect(preserveResult.existingPreserved).toBe(true);

        const aggregateCheck = JSON.parse(
          runSql(databaseUrl!, `
            SET search_path TO "${schemaName}";
            SELECT json_build_object(
              'allNotNull', count(*) FILTER (WHERE "displayId" IS NULL) = 0,
              'allUnique', count(*) = count(DISTINCT "displayId")
            )::text
            FROM "corrective_actions";
          `),
        ) as { allNotNull: boolean; allUnique: boolean };

        expect(aggregateCheck.allNotNull).toBe(true);
        expect(aggregateCheck.allUnique).toBe(true);
      } finally {
        dropSchema(schemaName, databaseUrl!);
      }
    },
  );

  runIfDatabaseAvailable(
    'continues numbering after existing numeric CAPA IDs on a partially migrated database',
    () => {
      const schemaName = `capa_displayid_collision_${Date.now()}_${process.pid}`.replace(/[^a-zA-Z0-9_]/g, '_');

      try {
        createSchema(schemaName, databaseUrl!);
        setSearchPath(schemaName, databaseUrl!);

        // Simulate a partially migrated database: some rows already have
        // numeric displayIds (CAPA-0001, CAPA-0002), the rest are still NULL.
        // The old migration would have re-issued CAPA-0001 / CAPA-0002 for the
        // NULL rows and crashed on the unique index creation.
        runSql(
          databaseUrl!,
          `SET search_path TO "${schemaName}"; CREATE TABLE "corrective_actions" (
            "id" TEXT PRIMARY KEY,
            "displayId" TEXT,
            "title" TEXT NOT NULL DEFAULT 'CAPA',
            "sourceType" TEXT NOT NULL DEFAULT 'audit',
            "ownerId" TEXT NOT NULL DEFAULT 'owner-1',
            "dueDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
            "status" TEXT NOT NULL DEFAULT 'open',
            "version" TEXT NOT NULL DEFAULT '1.0.0'
          );`,
        );

        runSql(
          databaseUrl!,
          `SET search_path TO "${schemaName}";
           INSERT INTO "corrective_actions" ("id", "displayId", "title") VALUES ('capa-a', 'CAPA-0001', 'Existing CAPA 1');
           INSERT INTO "corrective_actions" ("id", "displayId", "title") VALUES ('capa-b', 'CAPA-0002', 'Existing CAPA 2');
           INSERT INTO "corrective_actions" ("id", "displayId", "title") VALUES ('capa-c', NULL, 'Null CAPA 1');
           INSERT INTO "corrective_actions" ("id", "displayId", "title") VALUES ('capa-d', NULL, 'Null CAPA 2');`,
        );

        // Run migration; ON_ERROR_STOP=1 makes the old duplicate backfill fail
        // here when the unique index is created.
        execFileSync(
          'psql',
          [
            databaseUrl!,
            '--set',
            'ON_ERROR_STOP=1',
            '--quiet',
            '--no-psqlrc',
            '--command',
            `SET search_path TO "${schemaName}";`,
            '--file',
            migrationPath,
          ],
          { encoding: 'utf8', stdio: 'pipe' },
        );

        // Existing numeric displayIds are preserved; NULL rows continue the
        // numeric sequence (CAPA-0003, CAPA-0004).
        const result = JSON.parse(
          runSql(databaseUrl!, `
            SET search_path TO "${schemaName}";
            SELECT json_agg(json_build_object('id', "id", 'displayId', "displayId") ORDER BY "id")
            FROM "corrective_actions";
          `),
        ) as Array<{ id: string; displayId: string }>;

        expect(result).toHaveLength(4);
        expect(result.find((row) => row.id === 'capa-a')?.displayId).toBe('CAPA-0001');
        expect(result.find((row) => row.id === 'capa-b')?.displayId).toBe('CAPA-0002');
        expect(result.find((row) => row.id === 'capa-c')?.displayId).toBe('CAPA-0003');
        expect(result.find((row) => row.id === 'capa-d')?.displayId).toBe('CAPA-0004');

        // The unique index must exist — it is only reachable when the backfill
        // produced collision-free values.
        const uniqueCheck = JSON.parse(
          runSql(databaseUrl!, `
            SET search_path TO "${schemaName}";
            SELECT json_build_object(
              'allUnique', count(*) = count(DISTINCT "displayId"),
              'uniqueIndexPresent', (SELECT count(*) FROM pg_indexes
                WHERE schemaname = current_schema()
                  AND indexname = 'corrective_actions_displayId_key') > 0
            )::text
            FROM "corrective_actions";
          `),
        ) as { allUnique: boolean; uniqueIndexPresent: boolean };

        expect(uniqueCheck.allUnique).toBe(true);
        expect(uniqueCheck.uniqueIndexPresent).toBe(true);
      } finally {
        dropSchema(schemaName, databaseUrl!);
      }
    },
  );

  runIfDatabaseAvailable(
    'Action Center CAPA query returns items with displayId after migration',
    () => {
      const schemaName = `capa_actioncenter_${Date.now()}_${process.pid}`.replace(/[^a-zA-Z0-9_]/g, '_');

      try {
        createSchema(schemaName, databaseUrl!);
        setSearchPath(schemaName, databaseUrl!);

        // Create table simulating pre-migration state (no displayId)
        runSql(
          databaseUrl!,
          `SET search_path TO "${schemaName}"; CREATE TABLE "corrective_actions" (
            "id" TEXT PRIMARY KEY,
            "title" TEXT NOT NULL,
            "description" TEXT NOT NULL DEFAULT '',
            "sourceType" TEXT NOT NULL DEFAULT 'audit',
            "sourceId" TEXT,
            "ownerId" TEXT NOT NULL,
            "dueDate" TIMESTAMP(3) NOT NULL,
            "priority" TEXT NOT NULL DEFAULT 'medium',
            "status" TEXT NOT NULL DEFAULT 'open',
            "version" TEXT NOT NULL DEFAULT '1.0.0',
            "isArchived" BOOLEAN NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
          );`,
        );

        // Insert CAPA records matching Action Center query pattern
        runSql(
          databaseUrl!,
          `SET search_path TO "${schemaName}";
           INSERT INTO "corrective_actions" ("id", "title", "ownerId", "dueDate", "status", "sourceType")
           VALUES ('capa-ac-1', 'Fix login bug', 'user-1', '2026-01-05', 'open', 'audit');
           INSERT INTO "corrective_actions" ("id", "title", "ownerId", "dueDate", "status", "sourceType")
           VALUES ('capa-ac-2', 'Update docs', 'user-1', '2026-01-10', 'in_progress', 'risk');
           INSERT INTO "corrective_actions" ("id", "title", "ownerId", "dueDate", "status", "sourceType")
           VALUES ('capa-ac-3', 'Fix security issue', 'user-2', '2026-01-03', 'open', 'incident');`,
        );

        // Run migration
        execFileSync(
          'psql',
          [
            databaseUrl!,
            '--set',
            'ON_ERROR_STOP=1',
            '--quiet',
            '--no-psqlrc',
            '--command',
            `SET search_path TO "${schemaName}";`,
            '--file',
            migrationPath,
          ],
          { encoding: 'utf8', stdio: 'pipe' },
        );

        // Simulate Action Center query: find open CAPAs for a user
        const actionCenterResult = JSON.parse(
          runSql(databaseUrl!, `
            SET search_path TO "${schemaName}";
            SELECT json_agg(json_build_object(
              'id', "id",
              'title', "title",
              'displayId', "displayId",
              'status', "status",
              'ownerId', "ownerId",
              'dueDate', "dueDate"
            ) ORDER BY "dueDate", "sourceType", "id")
            FROM "corrective_actions"
            WHERE "status" IN ('open', 'pending', 'assigned', 'in_progress', 'planned', 'running', 'active', 'draft')
              AND "ownerId" = 'user-1'
              AND ("isArchived" = false);
          `),
        ) as Array<{ id: string; title: string; displayId: string; status: string; ownerId: string; dueDate: string }>;

        expect(actionCenterResult.length).toBe(2);
        expect(actionCenterResult[0].id).toBe('capa-ac-1');
        expect(actionCenterResult[0].displayId).toMatch(/^CAPA-\d{4}$/);
        expect(actionCenterResult[1].id).toBe('capa-ac-2');
        expect(actionCenterResult[1].displayId).toMatch(/^CAPA-\d{4}$/);

        // Verify displayId values are unique across all rows
        const uniqueCheck = JSON.parse(
          runSql(databaseUrl!, `
            SET search_path TO "${schemaName}";
            SELECT json_build_object(
              'allUnique', count(*) = count(DISTINCT "displayId")
            )::text
            FROM "corrective_actions";
          `),
        ) as { allUnique: boolean };

        expect(uniqueCheck.allUnique).toBe(true);
      } finally {
        dropSchema(schemaName, databaseUrl!);
      }
    },
  );
});
