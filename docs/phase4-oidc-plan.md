# Phase 4 OIDC consolidation plan

## Baseline inspection
- `git status --short` returned no output at start, so the working tree was clean before Phase 4 edits.
- Current backend dependency set already contains `openid-client` `^6.8.4`; backend TypeScript emits CommonJS, so Phase 4 will use a dynamic import adapter rather than downgrading unless build verification proves incompatibility.
- Current `backend/src/services/oidc.service.ts` uses a custom in-memory state/nonce/PKCE map, hand-built Microsoft authorize/token URLs, Graph userinfo fetch, custom PKCE validation, and email-based auto-linking.
- Current Prisma schema has `OidcConfig.clientSecret` as a legacy plaintext field and no durable login-state or provider-subject link table.
- Current auth routes accept `code_verifier` from the client callback; Phase 4 will bind the verifier server-side and ignore client-supplied verifier for the secure flow.

## Affected implementation files
- `backend/prisma/schema.prisma`: add durable `OidcLoginState`, `OidcAccountLink`, and secret reference support on `OidcConfig` while leaving legacy `clientSecret` deprecated for compatibility.
- `backend/prisma/migrations/*_phase4_oidc_consolidation/migration.sql`: persist schema changes.
- `backend/src/services/oidc.service.ts`: replace custom protocol validation with `openid-client`, persist hashed state, enforce single-use state, nonce, PKCE, tenant, and secure account-linking rules.
- `backend/src/routes/auth.routes.ts`: stop generating caller-provided state or accepting client PKCE verifier as security input; pass request context for normal session issuance.
- `backend/src/services/admin.service.ts` and admin OIDC route behavior only if needed to avoid exposing or requiring secrets.
- `backend/src/test/prisma-mock.ts`, `backend/src/test/fixtures.ts`, and focused OIDC/auth tests for the new models and flow.
- `backend/package.json` / lockfile only if dependency changes are required; currently no dependency add is planned because `openid-client` already exists.

## Security design
- Authorization initiation generates `state`, `nonce`, and PKCE verifier server-side. The state is returned to the browser only as part of the authorization URL and stored only as SHA-256 `stateHash` in the database.
- Login-state TTL is 10 minutes. Callback atomically consumes state by setting `usedAt`; missing, expired, or reused state is rejected.
- `openid-client` `buildAuthorizationUrl` builds the authorization URL and `authorizationCodeGrant` performs token exchange plus ID-token signature/issuer/audience/expiry and expected `state`, `nonce`, and PKCE verifier checks.
- Tenant enforcement remains explicit after library validation: for Entra-style configuration, the ID-token `tid` claim must equal `OidcConfig.tenantId`; issuer discovery also uses `https://login.microsoftonline.com/{tenantId}/v2.0`.
- Account linking uses `OidcAccountLink` keyed by provider/config and subject. Existing local users with matching email but no link are rejected and audited/logged; they are not auto-linked by email.
- Auto-provisioning can create a new external account only when enabled and approval is not required, then creates its provider-subject link in the same flow.
- OIDC callback issues the normal Phase 2 refresh-token session only after successful protocol validation and account/linking checks.
- New secure client secret handling resolves secrets from environment references such as `env:OIDC_CLIENT_SECRET`; legacy `clientSecret` remains a deprecated compatibility fallback only.

## Verification plan
- Backend build: `npm run build` in `backend`.
- Shared build: `npm run build` in `shared` if available.
- Frontend build: `npm run build` in `frontend` without interrupting active frontend test terminals.
- Prisma validate plus migrate status/deploy if migration is added.
- Focused OIDC tests and impacted auth route/service tests.
- Lint, documenting the known missing ESLint config baseline separately from Phase 4 regressions.

## Out of scope confirmation
- No Phase 5 risk `possibleImpact`, UI entity picker, audit hash chain, jobs, health/metrics, CI gates, or new ISMS functional modules will be implemented.
