# Phase 12: CI/CD Release Gates Plan

**Phase:** 12  
**Date:** 2026-07-27  
**Status:** In Progress  
**Commit Message Target:** `Phase 12: enforce CI/CD release gates`

## Requirements

| ID | Priority | Category | Description |
|----|----------|----------|-------------|
| CI-001 | P0 | CI/CD | CI pipeline must have all 12 mandatory jobs: build, lint, prisma validation, unit tests, integration tests, frontend tests, SAST, dependency scan, secret scan, SBOM, container scan. |
| CI-002 | P0 | CI/CD | Release gates must be checklist-driven with mandatory code review, test coverage >= 80%, security scan pass and changelog entry. |

## Current State Analysis

### Issues Found in `.github/workflows/ci.yml`

1. **Dependency scan neutralized** (lines 268, 272):
   - `npm audit --production --audit-level=high || true` — vulnerability check is neutralized with `|| true`, meaning high/critical vulnerabilities do NOT block the pipeline.
   - `npm audit --json > npm-audit-report.json 2>&1 || true` — same issue for report generation.

2. **Container scan neutralized** (line 346):
   - `docker build ... || true` — container build failure is silently ignored, so Trivy never scans anything.

3. **Semgrep SARIF format mismatch**:
   - Semgrep outputs JSON (`--json --output=semgrep-report.json`) but uploads via `github/codeql-action/upload-sarif@v3` which expects SARIF format. The JSON output is not valid SARIF and will fail or produce incorrect results in GitHub Security tab.

4. **Release gates incomplete**:
   - Missing mandatory job dependencies: `lint`, `container-scan`, `requirements-check`
   - Current needs: `build`, `prisma-validate`, `unit-tests`, `integration-tests`, `frontend-tests`, `sast`, `dependency-scan`, `secret-scan`, `sbom`
   - Should also need: `lint`, `container-scan`, `requirements-check`

5. **No requirements-check script**:
   - No script exists to validate requirement status (no P0/P1 `missing` or `non_compliant`, no undocumented `partial`, evidence references present).

6. **No CI config validation tests**:
   - No automated tests for CI configuration correctness.

## Phase 12 Changes

### 1. Harden Dependency Scan

**File:** `.github/workflows/ci.yml` (dependency-scan job)

- Remove all `|| true` neutralization from npm audit commands.
- High/Critical vulnerabilities MUST cause the pipeline to fail.
- Add explicit allowlist mechanism for known exceptions:
  - File: `docs/vulnerability-allowlist.json`
  - Schema: `{ "cve": string, "justification": string, "owner": string, "expiryDate": "YYYY-MM-DD" }[]`
  - CI step checks if any high/critical vulnerability CVE is in the allowlist with valid expiry; if not, fails.

### 2. Fix Semgrep SARIF Output

**File:** `.github/workflows/ci.yml` (sast job)

- Change Semgrep output from JSON to SARIF format: `--output-format=sarif --output=semgrep-results.sarif`
- Upload correct `.sarif` file via `upload-sarif@v3`.

### 3. Fix Container Scan

**File:** `.github/workflows/ci.yml` (container-scan job)

- Remove `|| true` from docker build step.
- Add fallback: if no Dockerfile exists, skip container scan with warning instead of failing silently.

### 4. Update Release Gates Dependencies

**File:** `.github/workflows/ci.yml` (release-gates job)

- Add missing mandatory jobs to `needs`: `lint`, `container-scan`, `requirements-check`.
- Final mandatory jobs list: `build`, `prisma-validate`, `unit-tests`, `integration-tests`, `frontend-tests`, `sast`, `dependency-scan`, `secret-scan`, `sbom`, `container-scan`, `lint`, `requirements-check`, `migration-test`.

### 5. Add Migration Test Job

**New job in `.github/workflows/ci.yml`:**

- Start with empty PostgreSQL database (fresh container).
- Run `prisma migrate deploy` to apply all migrations.
- Run seed script.
- Run integration tests against the freshly migrated DB.
- Optional migration reset for dev validation (commented out, opt-in).

### 6. Implement requirements-check Script

**New file:** `scripts/check-requirements.ts`

- Parse `docs/requirements.md` to extract all requirements with ID, priority, status.
- Check: no P0/P1 requirement has status `missing`.
- Check: no P0/P1 requirement has status `non_compliant`.
- Check: `partial` status only allowed with documented exception reference.
- Check: test or manual evidence reference present for each P0/P1 requirement.

**Updated file:** `package.json` (root)

- Add script: `"requirements-check": "tsx scripts/check-requirements.ts"`

### 7. Add CI Config Validation Tests

**New file:** `scripts/__tests__/ci-config.test.ts`

- Validate `.github/workflows/ci.yml` structure:
  - All mandatory jobs exist.
  - No `|| true` neutralization in gate-critical steps.
  - Semgrep outputs SARIF format.
  - Release gates depend on all required jobs.

### 8. Add Vulnerability Allowlist Script

**New file:** `scripts/check-vulnerabilities.ts`

- Parse `npm audit --json` output.
- Cross-reference with `docs/vulnerability-allowlist.json`.
- Fail if any high/critical vulnerability is not in allowlist or has expired.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/ci.yml` | Modified | Harden dependency scan, fix Semgrep SARIF, fix container scan, add migration-test job, update release-gates dependencies |
| `scripts/check-requirements.ts` | New | Requirements validation script |
| `scripts/check-vulnerabilities.ts` | New | Vulnerability allowlist checker |
| `scripts/__tests__/ci-config.test.ts` | New | CI config validation tests |
| `package.json` | Modified | Add requirements-check and vulnerability-check scripts |
| `docs/vulnerability-allowlist.json` | New | Allowlist for known vulnerabilities |
| `docs/phase12-cicd-gates-plan.md` | New | This plan document |

## Verification Steps

1. `npm run build --workspaces --if-present` — all workspaces build
2. `npx prisma validate` — schema valid
3. `npx prisma migrate status` — migrations up to date
4. `npm test --workspace=backend -- --coverage=false` — backend tests pass
5. `npm test --workspace=frontend -- --watch=false` — frontend tests pass
6. `npm run lint` — 0 errors
7. `npm run requirements-check` — requirements check passes
8. `npx tsx scripts/check-vulnerabilities.ts` — vulnerability scan (may report existing issues)
9. `npx vitest run scripts/__tests__/ci-config.test.ts` — CI config tests pass

## Known Limitations

- Dependency-scan now blocks on high/critical vulnerabilities; if any exist in current dependencies, they must be resolved or explicitly allowlisted with justification and expiry date.
- Container scan requires a valid `backend/Dockerfile`; if none exists, the job will fail (not skip silently).
- Semgrep SARIF output may differ from JSON in terms of rule coverage; review GitHub Security tab after first run.

## Out of Scope (Phase 13+)

- Compliance-doc rewrite (Phase 13)
- Code-quality architecture cleanup (Phase 14)
- New ISMS modules
