# Phase 1 Authorization Consolidation Plan

Phase 1 is limited to authorization and scoped permission hardening. Phase 2+ authentication/session, MFA pre-auth, OIDC, UI/entity picker, audit hash chain, jobs, health/metrics, CI gates, and unrelated refactors are explicitly out of scope.

## Pre-existing working-tree changes

Before Phase 1 implementation, `git status --short --branch` showed unrelated modified files in backend, frontend, shared, and planning areas. Phase 1 must touch some already-modified backend authorization/schema/route/service files; these are documented below and should be reviewed carefully when staging the final commit. Unrelated frontend/shared/risk-control-workflow files are not part of Phase 1.

## Baseline authorization findings

- [`backend/src/services/authorization.service.ts`](../backend/src/services/authorization.service.ts) currently uses coarse entity permission levels (`readonly`/`readwrite`) stored in `Role.entityPermissions` JSON and compares scoped `entityId` directly to `scopeId`, which is invalid for ISMS scope authorization.
- [`backend/src/middleware/entityAuth.ts`](../backend/src/middleware/entityAuth.ts) exposes generic entity read/write/delete guards and a generic `requireWritePermission` guard. Phase 1 replaces write/delete concepts with explicit granular permissions.
- [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) has `UserRole.scopeId` and `UserRole.organizationUnitId` but lacks typed role-permission rows and complete scoped assignment constraints for `LegalEntity`, `IsmsScope`, and `Site`.
- List endpoints such as [`backend/src/services/risk.service.ts`](../backend/src/services/risk.service.ts), [`backend/src/services/asset.service.ts`](../backend/src/services/asset.service.ts), [`backend/src/services/control.service.ts`](../backend/src/services/control.service.ts), and [`backend/src/services/incident.service.ts`](../backend/src/services/incident.service.ts) build filters from request query only and do not merge authorization filters into the query/count.
- Detail routes for [`backend/src/routes/asset.routes.ts`](../backend/src/routes/asset.routes.ts), [`backend/src/routes/risk.routes.ts`](../backend/src/routes/risk.routes.ts), [`backend/src/routes/control.routes.ts`](../backend/src/routes/control.routes.ts), and [`backend/src/routes/incident.routes.ts`](../backend/src/routes/incident.routes.ts) use `authenticate` without read authorization on key `GET /:id` endpoints.
- Existing tests in [`backend/src/__tests__/authorization.integration.test.ts`](../backend/src/__tests__/authorization.integration.test.ts) verify older coarse permissions and must be replaced/expanded for the 12 requested Phase 1 scenarios.

## Planned Phase 1 changes

- Add granular permission catalog support using `Permission` and `RolePermission` tables while preserving legacy role fields for compatibility.
- Extend role assignments with optional `legalEntityId`, `organizationUnitId`, `scopeId`, and `siteId` constraints on direct and group role assignments.
- Add real ISMS scope membership relation for legal entities so authorization never compares an entity ID directly to an ISMS scope ID.
- Replace the central authorization logic with `can()`, `canForEntity()`, `buildReadFilter()`, `require()`, and `requireForEntity()` and keep compatibility wrappers for older call sites.
- Replace the generic `requireWritePermission` pattern with explicit permission mapping middleware.
- Pass authorization filters into list/search services before pagination/count and enforce read/detail/create/update permissions in backend routes/services.
- Update integration tests and documentation for `AUTHZ-001` and `AUTHZ-002`.
