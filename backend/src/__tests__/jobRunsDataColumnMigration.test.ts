import { execFileSync } from 'child_process';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../prisma/migrations/20260809183000_repair_job_runs_data_column/migration.sql',
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

const runSql = (url: string, sql: string): string => execFileSync(
  'psql',
  [url, '--set', 'ON_ERROR_STOP=1', '--no-align', '--tuples-only', '--quiet', '--no-psqlrc', '--command', sql],
  { encoding: 'utf8', stdio: 'pipe' },
).trim();

// Opt-in integration verification: it uses an isolated schema in the supplied
// PostgreSQL database and leaves ordinary unit-test runs independent of psql.
describe('job_runs data-column repair migration', () => {
  const runIfDatabaseAvailable = databaseUrl && canUsePsql() ? it : it.skip;

  runIfDatabaseAvailable('adds nullable data without changing existing job-run values', () => {
    const schemaName = `job_runs_data_repair_${Date.now()}_${process.pid}`.replace(/[^a-zA-Z0-9_]/g, '_');

    try {
      runSql(databaseUrl!, `
        CREATE SCHEMA "${schemaName}";
        SET search_path TO "${schemaName}";
        CREATE TABLE "job_runs" ("id" TEXT PRIMARY KEY, "jobId" TEXT NOT NULL, "status" TEXT NOT NULL);
        INSERT INTO "job_runs" ("id", "jobId", "status") VALUES ('preserved', 'sync-assets', 'completed');
      `);

      for (let attempt = 0; attempt < 2; attempt += 1) {
        execFileSync(
          'psql',
          [databaseUrl!, '--set', 'ON_ERROR_STOP=1', '--quiet', '--no-psqlrc', '--command', `SET search_path TO "${schemaName}";`, '--file', migrationPath],
          { encoding: 'utf8', stdio: 'pipe' },
        );
      }

      const result = JSON.parse(runSql(databaseUrl!, `
        SET search_path TO "${schemaName}";
        SELECT json_build_object(
          'columnIsNullable', (
            SELECT is_nullable = 'YES'
            FROM information_schema.columns
            WHERE table_schema = '${schemaName}' AND table_name = 'job_runs' AND column_name = 'data'
          ),
          'existingRow', (SELECT json_build_object('jobId', "jobId", 'status', "status", 'data', "data") FROM "job_runs" WHERE "id" = 'preserved')
        )::text;
      `)) as { columnIsNullable: boolean; existingRow: { jobId: string; status: string; data: null } };

      expect(result.columnIsNullable).toBe(true);
      expect(result.existingRow).toEqual({ jobId: 'sync-assets', status: 'completed', data: null });
    } finally {
      runSql(databaseUrl!, `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    }
  });
});
