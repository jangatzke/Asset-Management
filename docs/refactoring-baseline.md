# Refactoring Baseline

| Kategorie | Ergebnis |
|---|---|
| Commit SHA | 772d868f50ba641f5a10355fb05bc3b11c1fd574 |
| Datum | 2026-07-26 |
| Backend Build | PASS: `npm run build --workspace=backend` exited 0. |
| Frontend Build | PASS with warning: `npm run build --workspace=frontend` exited 0; Vite reports one chunk at 894.90 kB and warns that chunks larger than 500 kB should be code-split or configured. |
| Shared Build | PASS: `npm run build --workspace=shared` exited 0. |
| Prisma Validate | PASS: `npm exec --workspace=backend -- prisma validate` exited 0. |
| Prisma Migration status | PASS against configured development database `asset_management` at `192.168.66.222:5432`: 18 migrations found and database schema is up to date. Command: `npm exec --workspace=backend -- prisma migrate status -- --schema=backend/prisma/schema.prisma`. |
| Unit Test Count | Backend full Jest baseline: FAIL after forced stop for open handles, summary reported 33 suites total, 30 passed, 3 failed; 469 tests total, 454 passed, 15 failed. Command: `npm test --workspace=backend -- --runInBand`. |
| Integration Test Count | PASS: `npm test --workspace=backend -- --runInBand --testPathPattern=integration` reported 1 suite passed and 27 tests passed. |
| Frontend Test Count | PASS: `npm test --workspace=frontend -- --run` reported 1 file passed and 4 tests passed. The discovered frontend test file is pre-existing uncommitted work and is treated as baseline state, not a Phase 0 feature addition. |
| Lint | FAIL: `npm run lint --workspaces --if-present` exited 2 because backend and frontend ESLint scripts cannot find an ESLint configuration file. Shared has no lint script. |
| CI/CD Workflow | INSPECTED: `.github/workflows/ci.yml` exists and defines preflight, lint, build, prisma-validate, unit-tests, integration-tests, frontend-tests, sast, dependency-scan, secret-scan, sbom, container-scan and release-gates. Known workflow concerns: Prisma commands run from repository root using default schema assumptions; `prisma format --check` may not be supported by the pinned Prisma version; container scan references `backend/Dockerfile` which is not present in the listed workspace. |
| bekannte Fehler | Backend full Jest fails in `admin.service.test.ts` because Prisma mock lacks `authSettings.findFirst`; `asset.crud.test.ts` because transaction mock lacks `assetType.findUnique`; `risktreatment.service.test.ts` because transaction mock lacks `treatmentAction.updateMany`. Jest also leaves async/open-handle logs after completion and had to be stopped after writing the summary. Lint fails because no ESLint configuration file is present for backend/frontend. |
| bekannte Warnungen | Frontend production build warns about a JavaScript chunk larger than 500 kB. Backend Jest logs after completion: standard asset types ensured, reminder automation disabled, background services initialized and server ready. |

## Package scripts and repository state

- Root scripts: `dev`, `dev:backend`, `dev:frontend`, `build`, `test`, `lint` and `format`.
- Backend scripts: `dev`, `build`, `start`, `test`, `lint`, `db:migrate`, `db:deploy`, `db:seed`, `db:generate` and `db:setup:cost-planning`.
- Frontend scripts: `dev`, `build`, `preview`, `test` and `lint`.
- Shared scripts: `build` and Unix-only `clean` using `rm -rf dist`.
- Prisma schema is `backend/prisma/schema.prisma` with migrations under `backend/prisma/migrations`.
- Baseline command artifacts are stored under `docs/baseline-artifacts`.
