# Phase 3 Pre-Authentication Plan

## Scope
Implement only Phase 3 pre-authentication for MFA and expired-password flows. Phase 4+ OIDC consolidation, risk possibleImpact, UI entity picker, audit hash chain, jobs, health/metrics, CI gates, and new ISMS modules are explicitly out of scope.

## Baseline inspected
- `git status --short` returned clean before implementation.
- Backend auth flow: `backend/src/services/auth.service.ts` currently verifies password, throws for forced MFA enrollment and expired passwords, uses a legacy MFA challenge JWT, and issues Phase 2 access token plus refresh cookie after full login.
- Backend routes: `backend/src/routes/auth.routes.ts` exposes `/auth/login`, `/auth/login/mfa`, authenticated MFA setup/confirm/disable, refresh, logout, and user endpoints.
- Admin recovery surface: `backend/src/routes/admin.routes.ts` and `backend/src/services/admin.service.ts` have admin user management but no MFA reset endpoint yet.
- Middleware: `backend/src/middleware/auth.ts` accepts only normal access JWTs for authenticated APIs; Phase 3 pre-auth tokens must remain rejected there.
- Prisma schema: `backend/prisma/schema.prisma` already has local MFA fields and Phase 2 `RefreshToken`; no persistence is required for short-lived stateless pre-auth tokens.
- Frontend login: `frontend/src/pages/Login.tsx`, `frontend/src/services/api.ts`, and `frontend/src/store/auth.ts` handle legacy MFA challenge responses and keep access tokens in memory.
- Tests/docs: existing auth/admin tests cover legacy behavior and must be adjusted/extended for Phase 3.

## Planned affected files
- `backend/src/services/auth.service.ts`: add explicit auth states, short-lived purpose-bound pre-auth JWTs, pre-auth MFA setup/confirm, MFA verify, expired-password change, and helper to issue Phase 2 sessions only after required gates are satisfied.
- `backend/src/routes/auth.routes.ts`: return state-machine responses from login, add pre-auth endpoints for MFA setup/confirm, MFA verify, and password change, set refresh cookie only for authenticated results.
- `backend/src/services/admin.service.ts` and `backend/src/routes/admin.routes.ts`: add admin MFA reset with audit event and re-enrollment behavior.
- `backend/src/__tests__/auth.service.test.ts`, `backend/src/__tests__/auth.routes.test.ts`, `backend/src/__tests__/admin.service.test.ts`: cover required Phase 3 flows and route cookie/session behavior.
- `frontend/src/services/api.ts`, `frontend/src/store/auth.ts`, `frontend/src/pages/Login.tsx`: support Phase 3 auth states without durable pre-auth storage and without treating pre-auth as an access token.
- `docs/security-model.md`, `docs/architecture.md`, `docs/requirements.md`, `docs/compliance-matrix.yml`, `docs/implementation-log.md`: document Phase 3 controls and verification.

## Design
- Auth states: `password_required`, `mfa_required`, `mfa_enrollment_required`, `password_change_required`, `authenticated`, and `disabled`.
- Pre-auth tokens are HS256 JWTs with `typ: pre_auth`, `userId`, and purpose (`mfa_required`, `mfa_enrollment`, `password_change`) and default 5-minute expiry via `PREAUTH_TOKEN_EXPIRES_IN`.
- Pre-auth tokens are accepted only by matching `/auth/preauth/*` endpoints. They do not contain `email`, are not accepted by normal authenticated middleware, and never create refresh-token records by themselves.
- Expired password or forced change is handled before MFA. After password change, the service re-evaluates MFA and either returns the next pre-auth state or issues a normal Phase 2 session.
- MFA enrollment pre-auth allows setup and confirmation only. Confirmation enables TOTP and then issues a normal Phase 2 session.
- MFA verification pre-auth validates TOTP and then issues a normal Phase 2 session.
- Disabled users return `disabled` and receive no pre-auth token or refresh cookie.
- Admin MFA reset clears enabled/pending TOTP fields, creates an audit event, and if MFA is forced the next login returns `mfa_enrollment_required`.

## Verification plan
Run focused Phase 3 backend tests, relevant frontend tests/builds, backend/shared builds, Prisma validate/status, and lint. Known Phase 2 baseline issues remain documented separately if encountered.
