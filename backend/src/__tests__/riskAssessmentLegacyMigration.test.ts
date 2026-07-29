import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { buildLegacyRiskAssessmentFixture } from '../test/riskAssessmentLegacyMigration.fixture';

const migrationPath = path.resolve(__dirname, '../../prisma/migrations/20260728190000_p0b_p0c_risk_assessment_version_consolidation/migration.sql');

const runSql = (databaseUrl: string, sql: string): void => {
  execFileSync('psql', [databaseUrl, '--set', 'ON_ERROR_STOP=1', '--quiet', '--no-psqlrc', '--command', sql], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
};

const queryJson = <T>(databaseUrl: string, sql: string): T => {
  const output = execFileSync('psql', [databaseUrl, '--no-align', '--tuples-only', '--quiet', '--no-psqlrc', '--command', sql], {
    stdio: 'pipe',
    encoding: 'utf8',
  }).trim();

  return JSON.parse(output) as T;
};

const canUsePsql = (): boolean => {
  try {
    execFileSync('psql', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe('risk assessment legacy migration verification', () => {
  const runIfDatabaseAvailable = databaseUrl && canUsePsql() ? it : it.skip;

  runIfDatabaseAvailable('converts disposable legacy risk_assessments into risk_assessment_versions and remaps dependents', () => {
    const fixture = buildLegacyRiskAssessmentFixture();
    const schemaName = `risk_assessment_legacy_${Date.now()}_${process.pid}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const tempDir = mkdtempSync(path.join(tmpdir(), 'risk-assessment-legacy-migration-'));
    const fixtureFile = path.join(tempDir, 'legacy-fixture.sql');

    try {
      writeFileSync(fixtureFile, fixture.sql, 'utf8');

      runSql(databaseUrl!, `CREATE SCHEMA "${schemaName}"; SET search_path TO "${schemaName}"; ${fixture.sql}`);
      execFileSync('psql', [databaseUrl!, '--set', 'ON_ERROR_STOP=1', '--quiet', '--no-psqlrc', '--command', `SET search_path TO "${schemaName}";`, '--file', migrationPath], {
        stdio: 'pipe',
        encoding: 'utf8',
      });

      const result = queryJson<{
        legacyTableExists: boolean;
        versions: Array<{
          id: string;
          riskId: string;
          riskMethodVersionId: string;
          versionNumber: number;
          assessmentType: string;
          likelihood: number;
          impact: number;
          inherentRisk: string;
          residualRisk: string;
          targetRisk: string;
          score: number;
          assessorId: string;
          assessedAt: string;
          nextReviewDate: string;
          justification: string;
          status: string;
          isCurrent: boolean;
          isClosed: boolean;
          closedAt: string | null;
          createdAt: string;
        }>;
        acceptance: {
          id: string;
          assessmentId: string;
          treatmentId: string;
          riskId: string;
          justification: string;
        };
        treatment: {
          id: string;
          assessmentId: string;
          residualAssessmentId: string;
          riskId: string;
        };
      }>(databaseUrl!, `
        SET search_path TO "${schemaName}";
        SELECT jsonb_build_object(
          'legacyTableExists', to_regclass('risk_assessments') IS NOT NULL,
          'versions', (
            SELECT jsonb_agg(to_jsonb(rav) ORDER BY rav."versionNumber")
            FROM "risk_assessment_versions" rav
            WHERE rav."riskId" = '${fixture.riskId}'
          ),
          'acceptance', (
            SELECT to_jsonb(acc)
            FROM "risk_acceptances" acc
            WHERE acc."id" = '${fixture.acceptanceId}'
          ),
          'treatment', (
            SELECT to_jsonb(rt)
            FROM "risk_treatments" rt
            WHERE rt."id" = '${fixture.treatmentId}'
          )
        )::text;
      `);

      expect(result.legacyTableExists).toBe(false);
      expect(result.versions).toHaveLength(2);

      expect(result.versions[0]).toMatchObject({
        id: fixture.legacyHistoricalAssessmentId,
        riskId: fixture.riskId,
        riskMethodVersionId: fixture.riskMethodVersionId,
        versionNumber: 1,
        assessmentType: 'current',
        likelihood: 2,
        impact: 3,
        inherentRisk: 'medium',
        residualRisk: 'low',
        targetRisk: 'low',
        score: 6,
        assessorId: 'assessor-historical',
        justification: 'Historical legacy justification',
        status: 'historical',
        isCurrent: false,
        isClosed: true,
      });
      expect(result.versions[0].closedAt).toContain('2026-02-15T10:00:00');

      expect(result.versions[1]).toMatchObject({
        id: fixture.legacyCurrentAssessmentId,
        riskId: fixture.riskId,
        riskMethodVersionId: fixture.riskMethodVersionId,
        versionNumber: 2,
        assessmentType: 'current',
        likelihood: 4,
        impact: 5,
        inherentRisk: 'critical',
        residualRisk: 'medium',
        targetRisk: 'low',
        score: 20,
        assessorId: 'assessor-current',
        justification: 'Current legacy justification with stable values',
        status: 'draft',
        isCurrent: true,
        isClosed: false,
        closedAt: null,
      });
      expect(result.versions[1].assessedAt).toContain('2026-03-20T11:30:00');
      expect(result.versions[1].nextReviewDate).toContain('2026-09-20T11:30:00');

      expect(result.acceptance).toMatchObject({
        id: fixture.acceptanceId,
        treatmentId: fixture.treatmentId,
        riskId: fixture.riskId,
        assessmentId: fixture.legacyCurrentAssessmentId,
        justification: 'Acceptance points at legacy current assessment before migration',
      });
      expect(result.treatment).toMatchObject({
        id: fixture.treatmentId,
        riskId: fixture.riskId,
        assessmentId: fixture.legacyHistoricalAssessmentId,
        residualAssessmentId: fixture.legacyCurrentAssessmentId,
      });
    } finally {
      runSql(databaseUrl!, `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
