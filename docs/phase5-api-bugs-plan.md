# Phase 5 API Bugs Plan

## Scope

Execute only Phase 5 concrete bug fixes and API consistency work. Phase 6+ service/module work, universal entity picker work, audit hash chains, jobs, health/metrics, CI gates, and broad DTO overhauls are explicitly out of scope.

## Baseline inspection

- `git status --short` was run first and returned no output, indicating a clean working tree before Phase 5 edits.
- Risk schema inspection shows `Risk.possibleImpact` already exists in Prisma, so no database migration is planned.
- Risk service inspection found create persistence currently maps `possibleImpact` from `description`, which conflates the two fields.
- Risk frontend inspection found the Risk form sends distinct `description` and `possibleImpact`, but organization-unit selection reuses the user search endpoint.
- Audit route inspection found `/audit-log/:id` registered before `/audit-log/export`, causing static export route shadowing.
- Comparable route-order inspection found additional static routes after parameterized routes in user, service-account, webhook, incident, risk method, and risk routes. Phase 5 will keep fixes limited to concrete static-vs-param collisions discovered during inspection.

## Planned affected files

- `backend/src/services/risk.service.ts` — persist and update `possibleImpact` independently of `description`.
- `backend/src/routes/auditLog.routes.ts` — register `/export` before `/:id`.
- `backend/src/routes/user.routes.ts` — register `/search` and `/owners` before `/:id`.
- `backend/src/routes/serviceAccount.routes.ts` — register `/auth` before `/:id` routes.
- `backend/src/routes/webhook.routes.ts` — register `/broadcast` before `/:id` routes.
- `backend/src/routes/incident.routes.ts` — register `/reports/:reportId/export` before `/:id` routes.
- `backend/src/routes/riskmethod.routes.ts` — register `/versions/...` routes before `/:id` routes.
- `backend/src/routes/risk.routes.ts` — ensure `/review-tasks/:taskId` remains before `/:id` routes.
- `backend/src/routes/organization.routes.ts` — provide a minimal real organization-unit list endpoint for picker usage.
- `frontend/src/services/api.ts` — add a minimal organization unit API helper.
- `frontend/src/pages/Risks.tsx` — use organization unit API for the organization unit picker and keep `possibleImpact` form binding distinct.
- Focused backend/frontend tests — cover possible-impact persistence, route collisions, and organization picker endpoint usage where practical.
- Documentation files required by Phase 5 — update requirements, compliance matrix, and implementation log after implementation/verification.

## Tests and verification plan

- Add a focused Risk create/read test with `description = "Ransomware auf ERP"` and `possibleImpact = "Produktionsstillstand für drei Tage"`.
- Add/adjust route collision tests for audit export and other concrete collisions found.
- Add/adjust frontend test coverage verifying Risk organization unit search uses organization endpoint rather than user search.
- Run backend build, frontend build, shared build, Prisma validate, focused backend/frontend tests, relevant integration tests, and lint. If no migration is added, Prisma migrate deploy/status is not required for Phase 5 schema changes.
