# Phase 6 DTO/API Contract Plan

## Scope

Phase 6 is limited to shared DTO and API contract hardening for the existing Asset Management resources. Phase 7 service extraction, universal entity picker work, and new ISMS modules are explicitly out of scope.

## Baseline

- `git status --short` was clean at phase start.
- Stabilization gates were provided as green before this phase.
- Initial inspection found local Zod schemas in backend routes that duplicated shared DTOs for assets, risks, controls, and incidents.
- Frontend API client methods for target resources used broad `any` payload/query types.

## Target resources

- Asset
- Risk
- Control
- ControlImplementation
- RiskControl
- RiskAssessment / RiskAssessmentVersion workflow inputs
- Incident

## Structure

For Phase 6 target resources, the contract direction is:

1. Shared Zod schema in `shared/src/dtos/index.ts`
2. Shared TypeScript input/output types derived from the schema
3. Backend `validateBody`, `validateQuery`, or `validateParams` using the shared schema
4. OpenAPI schema aligned with the same request shape
5. Frontend API client method typed with the shared DTO where practical

## Affected files

- `shared/src/dtos/index.ts`
- `backend/src/routes/asset.routes.ts`
- `backend/src/routes/risk.routes.ts`
- `backend/src/routes/control.routes.ts`
- `backend/src/routes/incident.routes.ts`
- `frontend/src/services/api.ts`
- `frontend/src/services/api.test.ts`
- `backend/src/__tests__/phase6.dto-contract.test.ts`
- `docs/api/openapi.yaml`
- `docs/requirements.md`
- `docs/compliance-matrix.yml`
- `docs/implementation-log.md`

## Validation and tests

- Add contract tests proving shared schemas are accepted by backend validation middleware and reject invalid payloads.
- Keep frontend API client contract tests compile-time typed against shared DTOs.
- Run backend, shared, and frontend builds, Prisma validate/status, backend Jest, frontend Vitest, and workspace lint.

## Constraints

- Do not introduce parallel DTO truth.
- Do not add new unbounded `any` for target CRUD endpoints.
- Do not weaken Phase 1–5 security/session behavior.
- Restore `noUnusedLocals` for backend where feasible.
