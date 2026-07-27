# Phase 11: Health Readiness and Metrics Hardening Plan

**Date:** 2026-07-26  
**Status:** In Progress  
**Preceded by:** Phase 10 (Background Jobs Cluster-Safety) — commit `e1933ec`

## Objective

Harden health/readiness endpoints to perform real, structured checks against all configured integrations. Replace the fixed-delay/pauschal READY behavior with actual database reachability, schema/migration status validation, and required-secrets verification. Add Prometheus-compatible metrics via `prom-client`, protect `/metrics` with token auth, and add comprehensive tests.

## Affected Files

| File | Change |
|------|--------|
| `backend/src/middleware/health.ts` | Restructure readiness to perform real checks (DB, schema, secrets, optional integrations). Return structured `{ status, database, intune, smtp, ... }`. |
| `backend/src/middleware/metrics.ts` | Replace in-memory counters with `prom-client` Histogram/Counter/Gauge. Add token auth middleware for `/metrics`. |
| `backend/src/index.ts` | Wire integration health checks into readiness. Protect `/metrics` with token middleware. Export app for tests. |
| `backend/.env.example` | Document `METRICS_TOKEN`, `HEALTH_CHECK_NETWORK_TIMEOUT_MS`. |
| `backend/src/__tests__/phase11.health-readiness.test.ts` | New: readiness success/failure/degraded, secret redaction. |
| `backend/src/__tests__/phase11.metrics-auth.test.ts` | New: metrics auth, token validation, unauthorized access. |
| `backend/src/__tests__/phase11.metrics-output.test.ts` | New: metrics output format, request counter/latency/error observations. |
| `docs/requirements.md` | Add Phase 11 requirements section. |
| `docs/compliance-matrix.yml` | Update compliance status for OPS-004 and new Phase 11 items. |
| `docs/implementation-log.md` | Log Phase 11 implementation details. |
| `docs/operations.md` | Document health/readiness/metrics operational procedures. |

## Design Decisions

### Readiness Checks

1. **Database (required):** Execute `SELECT 1` against Prisma. If it fails, status = `not_ready`.
2. **Schema/Migration Status:** Run a safe `SELECT version_num FROM _prisma_migrations order by started_at desc limit 1` or use Prisma `$queryRaw` to check migration state. Mark as `ok`, `pending`, or `error`.
3. **Required Secrets:** Check that `JWT_SECRET`, `DATABASE_URL` are set. If missing, mark as `not_ready`. Do NOT log actual values.
4. **Optional Integrations (Intune, SMTP, VMware, Proxmox):** Attempt lightweight check (e.g., Intune health endpoint logic). On failure, mark as `degraded` but server can still be `healthy` if DB + secrets are fine.

### Health Response Structure

```json
{
  "status": "healthy" | "degraded" | "not_ready",
  "database": { "status": "healthy" | "unhealthy", "durationMs": 12 },
  "schema": { "status": "ok" | "pending" | "error", "details": "..." },
  "secrets": { "status": "ok" | "missing", "checked": ["JWT_SECRET", "DATABASE_URL"] },
  "intune": { "status": "healthy" | "unhealthy" | "skipped", "configured": true },
  "smtp": { "status": "healthy" | "unhealthy" | "skipped", "configured": false },
  "ready": true,
  "uptime": 12345,
  "timestamp": "2026-07-26T23:00:00.000Z"
}
```

### Metrics with prom-client

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, status, endpoint |
| `http_request_duration_seconds` | Histogram | Request latency in seconds |
| `http_errors_total` | Counter | Total error responses (4xx/5xx) |
| `db_errors_total` | Counter | Database errors |
| `job_run_duration_seconds` | Histogram | Background job duration |
| `job_runs_failed_total` | Counter | Failed background jobs |
| `integration_sync_status` | Gauge | Integration sync status (1=ok, 0=error) |

### /metrics Protection

- Env var `METRICS_TOKEN` (optional). If set, require `?token=<value>` or `Authorization: Bearer <token>`.
- If not set, `/metrics` is accessible but documented as requiring network-level protection in production.
- Token is never logged or returned in responses.

## Implementation Steps

1. **Document plan** (this file) — DONE
2. **Refactor health.ts** — real readiness checks with structured response
3. **Install prom-client** and refactor metrics.ts — proper Prometheus types
4. **Protect /metrics** with token auth middleware
5. **Wire integration health checks** in index.ts
6. **Add tests** for all new functionality
7. **Update docs** (requirements, compliance, operations, implementation-log)
8. **Run verification** (builds, Prisma, tests, lint)
9. **Commit Phase 11 only**

## Constraints

- No secrets/credentials leaked in health response.
- `/metrics` protected by token if `METRICS_TOKEN` is set.
- No empty `catch {}`; no new unbounded `any`.
- Optional integrations produce `degraded`, not necessarily `not_ready`.
- Windows/PowerShell-compatible commands only.

## Known Issues / Risks

- `prom-client` needs to be added as a dependency; ensure it works with ESM/CommonJS interop in tsx.
- Prisma migration status check may require admin privileges depending on DB schema.
- Some integration health checks (VMware, Proxmox) may not have lightweight endpoints — will use config-based skip if unreachable.
