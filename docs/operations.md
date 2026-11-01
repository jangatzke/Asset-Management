# Operations Manual — Asset Management System (Phase 8)

**Version:** 1.0.0  
**Last Updated:** 2026-07-19  
**Status:** Production Ready (Phase 8)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Health Checks & Monitoring](#2-health-checks--monitoring)
3. [Structured Logging](#3-structured-logging)
4. [Correlation IDs](#4-correlation-ids)
5. [Metrics](#5-metrics)
6. [Backup & Restore](#6-backup--restore)
7. [Secret Rotation](#7-secret-rotation)
8. [Container Hardening](#8-container-hardening)
9. [Environment Separation](#9-environment-separation)
10. [Graceful Shutdown](#10-graceful-shutdown)
11. [CI/CD Release Gates](#11-cicd-release-gates)
12. [Branch Protection](#12-branch-protection)
13. [Disaster Recovery](#13-disaster-recovery)
14. [Runbook: Common Issues](#14-runbook-common-issues)

---

## 1. System Overview

### Architecture
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Backend     │────▶│   PostgreSQL│
│   (React)   │◀────│  (Express)   │◀────│   (16+)     │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │ Webhook      │
                    │ Outbound     │
                    └──────────────┘
```

### Components
| Component | Technology | Port | Purpose |
|-----------|------------|------|---------|
| Frontend | React + Vite | 3000 (dev, Vite) / 8080→80 (prod, nginx via `FRONTEND_PORT`) | UI |
| Backend | Express + TypeScript | 3001 (default dev and prod) | API Server |
| Database | PostgreSQL | 5432 | Data Store |
| Prisma ORM | — | — | Schema Management |

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/asset_management?schema=public
JWT_SECRET=<32-char-random-string>   # required; app refuses to start without it in production
NODE_ENV=production|development

# Optional (names per backend/.env.example)
PORT=3001
HOST=127.0.0.1                       # bind address; 0.0.0.0 only when externally reachable
TRUST_PROXY=1
CORS_ORIGINS=https://yourdomain.com  # comma-separated, no wildcard default

# Metrics (Phase 11)
METRICS_TOKEN=<strong-random-token>   # required in production; /metrics returns 503 without it
```

---

## 2. Health Checks & Monitoring

### Endpoints

> Note: health endpoints are registered at the **root path** in `backend/src/index.ts`, not under `/api/v1`. The production nginx only proxies `/api`, so probes must target the backend directly (e.g. container port 3001).

| Endpoint | Method | Purpose | Response Time SLA |
|----------|--------|---------|-------------------|
| `/health` | GET | Legacy basic health check | <100ms |
| `/health/live` | GET | Kubernetes liveness probe | <100ms |
| `/health/ready` | GET | Kubernetes readiness probe | <500ms |
| `/metrics` | GET | Prometheus metrics | <200ms |

### Liveness Probe (`/health/live`)
Returns 200 if the server process is alive.

```json
{
  "status": "ok",
  "uptime": 86400,
  "timestamp": "2026-07-19T10:00:00.000Z"
}
```

**Failure handling:** Kubernetes will restart the container.

### Readiness Probe (`/health/ready`)
Returns a structured health status with real readiness checks (Phase 11 enhancement).

**Status values:** `healthy` (all checks pass), `degraded` (optional integrations unavailable), `not_ready` (critical failure).

```json
{
  "status": "healthy",
  "ready": true,
  "uptime": 86400,
  "timestamp": "2026-07-27T10:00:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database reachable",
      "duration": 5
    },
    "schema": {
      "status": "healthy",
      "message": "No pending migrations",
      "latestMigration": "20260726231700_phase10_job_tracking",
      "pendingCount": 0,
      "duration": 8
    },
    "secrets": {
      "status": "healthy",
      "details": ["JWT_SECRET", "DATABASE_URL"],
      "message": "All required secrets configured"
    },
    "intune": {
      "status": "skipped",
      "message": "Not configured"
    },
    "smtp": {
      "status": "skipped",
      "message": "Not configured"
    }
  }
}
```

**Status transitions:**
| Condition | Status | HTTP Code |
|-----------|--------|-----------|
| All critical checks pass, optional skipped/healthy | `healthy` | 200 |
| Optional integration unhealthy (Intune/SMTP/VMware) | `degraded` | 200 |
| Database unreachable or required secrets missing | `not_ready` | 503 |

**Failure handling:** Kubernetes removes the pod from service endpoints.

### Metrics Endpoint (`/metrics`)
Prometheus-compatible metrics endpoint (Phase 11: protected by `METRICS_TOKEN`).

**Authentication:** Requires the `Authorization: Bearer <token>` header; query-parameter tokens were removed to avoid leaking secrets in URLs. Without a valid token, returns HTTP 401. If `METRICS_TOKEN` is unset in production, `/metrics` returns HTTP 503 (fail-closed); in development it stays unauthenticated.

```bash
# Access with token (backend default port 3001)
curl -H "Authorization: Bearer my-metrics-token" http://localhost:3001/metrics
```

**Exposed metrics (per `backend/src/middleware/metrics.ts`):**

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `http_requests_total` | counter | Total HTTP requests | method, status, endpoint |
| `http_request_duration_seconds` | histogram | Request duration in seconds | method, status, endpoint |
| `http_errors_total` | counter | Total HTTP errors (4xx/5xx) | status_class |
| `db_errors_total` | counter | Database query errors | - |
| `job_run_duration_seconds` | histogram | Background job run duration in seconds | jobId, status |
| `job_runs_failed_total` | counter | Failed background jobs | jobId |
| `integration_sync_status` | gauge | Integration sync status (1=ok, 0=error, -1=unknown) | integration |

**Example output:**

```prometheus
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",endpoint="/api/v1/assets",status="200"} 1500
http_requests_total{method="POST",endpoint="/api/v1/assets",status="201"} 50

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",endpoint="/api/v1/assets",status="200",le="0.05"} 1200
http_request_duration_seconds_bucket{method="GET",endpoint="/api/v1/assets",status="200",le="0.1"} 1400
http_request_duration_seconds_bucket{method="GET",endpoint="/api/v1/assets",status="200",le="0.25"} 1480
http_request_duration_seconds_bucket{method="GET",endpoint="/api/v1/assets",status="200",le="+Inf"} 1500

# HELP http_errors_total Total number of HTTP error responses (4xx and 5xx).
# TYPE http_errors_total counter
http_errors_total{status_class="4xx"} 7
http_errors_total{status_class="5xx"} 1
```

---

## 3. Structured Logging

### Format
All logs are emitted as JSON objects:

```json
{
  "level": "info",
  "timestamp": "2026-07-19T10:00:00.000Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "path": "/api/assets/abc123",
  "statusCode": 200,
  "durationMs": 45,
  "userAgent": "Mozilla/5.0...",
  "ipAddress": "192.168.1.100",
  "requestSize": 0,
  "responseSize": 1024
}
```

### Security
- **No secrets or tokens are logged.** The access log itself only contains method, path, status, duration, user agent, IP and content-length headers; sensitive request headers (`authorization`, `cookie`, …) are never part of the log entry (see `backend/src/middleware/jsonLogger.ts`).
- > Status note (2026-10-30): earlier revisions claimed request bodies were "hashed for audit purposes" — the logging middleware does not read or hash request bodies at all.

### Log Levels
The access logger assigns levels solely by status code (`jsonLogger.ts:109-114`):

| Level | Usage | Example |
|-------|-------|---------|
| error | System errors, 5xx responses | Database connection failure |
| warn | Client errors (4xx) | Rate limit exceeded |
| info | Normal operations | Request completed successfully |

### Log Aggregation
In production, pipe logs to your logging service:

```bash
# Example: Pipe to stdout for Docker log collection
node dist/index.js 2>&1 | jq -c '.' > /var/log/asset-mgmt.log
```

---

## 4. Correlation IDs

### Mechanism
Every request receives a unique correlation ID:

1. **Incoming request without X-Correlation-Id:** Server generates UUID v4
2. **Incoming request with X-Correlation-Id:** Server uses provided value
3. **Response header:** `X-Correlation-Id` is always included

### Header Flow
```
Client → Server: GET /api/assets [X-Correlation-Id: abc-123]
Server → Client: 200 OK [X-Correlation-Id: abc-123]
```

### Usage in Logs
All log entries for a request share the same `correlationId`, enabling full traceability.

---

## 5. Metrics

### Prometheus Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'asset-management'
    metrics_path: '/metrics'
    authorization_credentials: '<METRICS_TOKEN>'   # /metrics requires Bearer auth
    static_configs:
      - targets: ['backend:3001']
    scrape_interval: 15s
```

### Key Alerts
| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | `rate(http_errors_total{status_class="5xx"}[5m]) > 0.05` | P0 |
| SlowResponse | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1` | P1 |
| DatabaseDown | `up{job="asset-management"} == 0` for 30s | P0 |

> Status note (2026-10-30): the previous "WebhookQueueBacklog" alert referenced a `webhook_queue_size` metric that the backend does not expose; it was removed. The duration histogram is in seconds (`http_request_duration_seconds`, `metrics.ts:24-29`).

---

## 6. Backup & Restore

### Backup Strategy

#### Database Backups
```bash
# Full backup (daily)
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME --format=custom --compress=9 -f /backups/asset-mgmt-$(date +%Y%m%d).dump

# WAL archiving (continuous, for point-in-time recovery)
# Configure in postgresql.conf:
# wal_level = replica
# archive_mode = on
# archive_command = 'cp %p /backups/wal/%f'
```

#### Configuration Backups
```bash
# Backup environment configuration (never backup secrets directly!)
tar -czf /backups/config-$(date +%Y%m%d).tar.gz \
  --exclude='*.key' \
  --exclude='*.pem' \
  backend/.env.example frontend/.env.example docs/
```

### Restore Procedures

#### Full Database Restore
```bash
# 1. Stop the backend container (Compose-based deployment)
docker compose stop backend

# 2. Restore from backup
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME --clean --if-exists /backups/asset-mgmt-20260719.dump

# 3. Verify migration state (in the backend workspace; loads backend/.env automatically)
npm run db:deploy --workspace backend   # or: npx prisma migrate status --schema=backend/prisma/schema.prisma

# 4. Restart application
docker compose start backend

# 5. Run readiness check (health endpoints are at the root path on the backend port)
curl -f http://localhost:3001/health/ready || echo "RESTORE FAILED"
```

> Status note (2026-10-30): the previous example referenced a Kubernetes deployment (`kubectl rollout …`) and `http://localhost:3000/health/ready`; this project ships a Docker Compose stack and the backend listens on port 3001.

#### Restore Test Schedule
| Frequency | Type | Responsible |
|-----------|------|-------------|
| Monthly | Full restore to staging | DevOps |
| Quarterly | DR failover test | Operations |
| After major migration | Immediate restore verification | DBA |

### Retention Policy
| Data Type | Backup Frequency | Retention | Location |
|-----------|-----------------|-----------|----------|
| Database (full) | Daily | 30 days | Local + S3 |
| WAL archives | Continuous | 7 days | Local |
| Configuration | On change | 90 days | Git |
| Logs | — | 14 days | Log aggregator |

---

## 7. Secret Rotation

### Secrets Inventory
| Secret | Storage | Rotation Period | Owner |
|--------|---------|-----------------|-------|
| JWT_SECRET | Environment variable | 90 days | Security |
| DATABASE_URL | Environment variable | 180 days | DBA |
| Webhook signing keys | Generated per webhook | 365 days | System |
| Service account tokens | Generated per SA | 90 days | Admin |

### Rotation Procedure

#### JWT Secret Rotation
The backend verifies tokens with a single `JWT_SECRET` (there is no `JWT_SECRET_OLD` dual-signing support in the code), so rotation invalidates all outstanding access tokens; refresh sessions are re-established on next login/refresh.

```bash
# 1. Generate new secret
NEW_JWT_SECRET=$(openssl rand -base64 32)

# 2. Update JWT_SECRET in the deployment environment and restart the backend
docker compose up -d backend

# 3. Verify readiness (root-path endpoint on the backend port)
curl -s http://localhost:3001/health/ready | jq .checks
```

> Status note (2026-10-30): replaced the previous Kubernetes/dual-signing example, which did not match this deployment model or the code.

#### Service Account Token Regeneration
Via API (admin-authenticated, path includes the `/api/v1` prefix):
```bash
curl -X POST https://your-host/api/v1/service-accounts/{id}/regenerate-token \
  -H "Authorization: Bearer {admin-token}" \
  | jq .newToken
```

### Secret Rotation Alerts
| Alert | Threshold |
|-------|-----------|
| JWT age > 75 days | Warning |
| JWT age > 89 days | Critical |
| Service account token > 80 days | Warning |

---

## 8. Container Hardening

### Dockerfile Best Practices
```dockerfile
# Use minimal base image
FROM node:20-alpine AS production

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Set security options
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Health check in container
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

# Read-only root filesystem (if possible)
# RUN chmod -R a+w /tmp /var/cache
```

### Kubernetes Security Context
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 3000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
```

### Image Scanning
- **Tool:** Trivy (integrated in CI)
- **Frequency:** Every build + weekly scheduled scan
- **Policy:** No CRITICAL or HIGH vulnerabilities allowed

---

## 9. Environment Separation

### Environments
| Environment | Purpose | Branch | Access |
|-------------|---------|--------|--------|
| Development | Feature development | feature/* | All developers |
| Staging | Pre-production testing | develop | QA, DevOps |
| Production | Live service | main | Release managers |

### Configuration Isolation
```yaml
# Each environment has isolated:
# - Database (separate cluster/instance)
# - Redis cache (separate namespace)
# - Secrets (secrets manager per env)
# - Webhook endpoints (different URLs)
```

### Deployment Matrix
| Component | Dev | Staging | Production |
|-----------|-----|---------|------------|
| Replicas | 1 | 2 | 3+ |
| Resource limits | 512MB / 0.5 CPU | 1GB / 1 CPU | 2GB / 2 CPU |
| Logging | debug | info | warn |
| Metrics | enabled | enabled | enabled + alerts |

---

## 10. Graceful Shutdown

### Shutdown Process
Implemented in `backend/src/middleware/gracefulShutdown.ts` (registered via `setupGracefulShutdown(server)` in `src/index.ts:376`):

```typescript
// gracefulShutdown.ts (simplified)
process.on('SIGTERM', () => gracefulShutdown(server, signalTimeout, dbTimeout));
process.on('SIGINT', () => gracefulShutdown(server, signalTimeout, dbTimeout));

async function gracefulShutdown(server, signalTimeout = 30000, dbTimeout = 10000) {
  // Force-exit timer (signalTimeout, default 30s) armed first
  // 1. Stop accepting new connections
  server.close();
  // 2. Stop idempotency cleanup interval + webhook queue worker
  stopIdempotencyCleanup();
  stopWebhookQueueWorker();
  // 3. Disconnect Prisma with a bounded timeout (dbTimeout, default 10s)
  await Promise.race([prisma.$disconnect(), timeout(dbTimeout)]);
}
```

`uncaughtException`/`unhandledRejection` also trigger the same shutdown path (`gracefulShutdown.ts:34-44`).

> Status note (2026-10-30): the previous pseudo-code claimed `webhookService.drainQueue()` and a Kubernetes PodDisruptionBudget; the actual code stops the webhook queue worker via `stopWebhookQueueWorker()`, and this project deploys with Docker Compose rather than Kubernetes. The PDB example was removed.

---

## 11. CI/CD Release Gates

### Gate Checklist
Before any release to production, ALL of the following must pass:

| # | Gate | Check | Status |
|---|------|-------|--------|
| G1 | Build | `npm run build` succeeds for all workspaces | ✅ |
| G2 | Prisma Schema | `prisma validate` passes | ✅ |
| G3 | Prisma Migration | Schema matches migration history | ✅ |
| G4 | Unit Tests | All unit tests pass (coverage ≥ 80%) | ✅ |
| G5 | Integration Tests | All integration tests pass | ✅ |
| G6 | Frontend Tests | All frontend tests pass | ✅ |
| G7 | SAST | No HIGH/MEDIUM findings from Semgrep | ✅ |
| G8 | Dependency Scan | No CRITICAL vulnerabilities (npm audit) | ✅ |
| G9 | Secret Scan | No secrets detected in git history | ✅ |
| G10 | SBOM | CycloneDX SBOM generated and attached | ✅ |
| G11 | Container Scan | No CRITICAL/HIGH vulnerabilities (Trivy) | ✅ |

### Release Approval Workflow
```
PR Created → CI Runs (G1-G11) → Code Review → Merge to develop
→ Staging Deploy → Manual QA Sign-off → Merge to main
→ Production Deploy (auto or manual)
```

### Rollback Procedure
With the Docker Compose stack, roll back by redeploying the previous image tag and restarting the backend service:

```bash
# 1. Point docker-compose.yml (or your registry tag) at the last known good image
# 2. Recreate the backend container
docker compose up -d backend
# 3. Verify readiness (root-path endpoint on the backend port)
curl -s http://localhost:3001/health/ready | jq .
```

> Status note (2026-10-30): replaced the previous `kubectl rollout` example, which does not match this deployment model.

---

## 12. Branch Protection

### Required protection for `main`

Branch protection is a repository-administration setting and cannot be enabled
by an application pull request or by the ordinary read-only GitHub Actions
token. A repository administrator must enable the following active branch
ruleset for `main` before the next production release:

| Rule | Required setting |
|------|------------------|
| Target | Include the default branch: `main` |
| Pull requests | Require a pull request before merging; require at least one approving review |
| Review freshness | Dismiss stale approvals when new commits are pushed |
| Required checks | Require status checks to pass and require branches to be up to date; select `Release Gates` |
| Force pushes | Disallow |
| Deletions | Disallow |
| Bypasses | Do not grant a bypass to individuals, teams, or GitHub Apps except an explicitly approved emergency-break-glass process |

`Release Gates` is the aggregate workflow job in `.github/workflows/ci.yml`.
It only succeeds after the build, schema validation, test, security, SBOM,
requirements, and migration checks have succeeded. Requiring this single
check avoids an incomplete branch-protection configuration when CI jobs are
changed over time.

### Administrator procedure (GitHub UI)

1. Open **Repository settings → Rules → Rulesets → New branch ruleset**.
2. Name the ruleset `Protect main`, set enforcement to **Active**, and target
   the default branch (`main`).
3. Enable the rules in the table above. Under required status checks, choose
   **Require status checks to pass**, **Require branches to be up to date
   before merging**, and add the `Release Gates` check.
4. Save the ruleset, then create a test pull request. Confirm direct pushes to
   `main` are rejected and merge remains blocked until `Release Gates` and the
   required review succeed.

### API verification (administrator token)

With a fine-grained personal access token that has repository administration
permission, verify the active protection configuration after any ruleset
change:

```bash
curl --fail-with-body \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_ADMIN_TOKEN" \
  "https://api.github.com/repos/OWNER/REPOSITORY/branches/main/protection"
```

The response must show required status checks enabled and include the
`Release Gates` context. Record the verification in the release evidence.

---

## 13. Disaster Recovery

### RTO/RPO Targets
| Metric | Target | Current |
|--------|--------|---------|
| RTO (Recovery Time Objective) | < 4 hours | ~2 hours |
| RPO (Recovery Point Objective) | < 1 hour | ~15 minutes (WAL) |

### DR Runbook
1. **Detect:** Monitoring alerts trigger on health check failures > 5 min
2. **Assess:** Determine scope (database, application, region)
3. **Notify:** Slack #incidents, PagerDuty for P0/P1
4. **Recover:**
   - Database: Restore from latest backup + WAL replay
   - Application: Redeploy from known good image
   - Region: Failover to secondary region (if configured)
5. **Verify:** Run smoke tests, check health endpoints
6. **Communicate:** Update status page, notify stakeholders

### DR Test Schedule
| Frequency | Type | Responsible |
|-----------|------|-------------|
| Quarterly | Full DR drill | Operations |
| Monthly | Database restore test | DBA |

---

## 14. Runbook: Common Issues

### Issue: High Error Rate
```bash
# 1. Check health endpoints (root path, backend port)
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready

# 2. Check logs for correlation IDs (Compose ships logs to stdout)
docker compose logs backend --since 30m | grep error | tail -50

# 3. Check database connectivity
pg_isready -h $DB_HOST -p 5432

# 4. Restart if necessary
docker compose restart backend
```

### Issue: Database Connection Pool Exhaustion
```bash
# 1. Check current connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# 2. Kill idle connections
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '30 minutes';"

# 3. Increase pool size in connection string
DATABASE_URL="postgresql://user:pass@host:5432/assetmgmt?connection_limit=20"
```

### Issue: Webhook Delivery Failures
```bash
# 1. Check job metrics (failed webhook queue runs are tracked with jobType 'webhook')
curl -H "Authorization: Bearer $METRICS_TOKEN" http://localhost:3001/metrics | grep job_runs_failed_total

# 2. List recent deliveries (via API, admin/service-account auth)
curl https://your-host/api/v1/webhooks/deliveries \
  -H "Authorization: Bearer {token}"

# 3. Test a specific webhook configuration
curl -X POST https://your-host/api/v1/webhooks/{id}/test \
  -H "Authorization: Bearer {token}"
```

> Status note (2026-10-30): the previous example used a non-existent `webhook_queue_size` metric and un-prefixed `/webhooks` URLs; delivery history is exposed via `GET /api/v1/webhooks/deliveries`.

---

## Appendix A: API Scopes Reference

Service-account scopes (validated by the service-account routes) map to the `/api/v1` route groups; all `/api/v1/webhooks` and `/api/v1/service-accounts` management routes additionally require an `admin`-authenticated or scoped service-account principal:

| Scope | Description | Endpoints |
|-------|-------------|-----------|
| `assets:read` | View assets | GET /api/v1/assets* |
| `assets:write` | Create/update assets | POST/PATCH/DELETE /api/v1/assets* |
| `risks:read` | View risks | GET /api/v1/risks* |
| `risks:write` | Manage risks | POST/PATCH/DELETE /api/v1/risks* |
| `webhooks:read` | View webhooks | GET /api/v1/webhooks* |
| `webhooks:write` | Manage webhooks | POST/PATCH/DELETE /api/v1/webhooks* |
| `serviceaccounts:read` | View service accounts | GET /api/v1/service-accounts* |
| `serviceaccounts:write` | Manage service accounts | POST/PATCH/DELETE /api/v1/service-accounts* |

## Appendix B: Webhook Events Reference

| Event | Payload | Retry Policy |
|-------|---------|-------------|
| `asset.created` | Asset object | 3 retries, exponential backoff |
| `asset.updated` | Asset object + changes | 3 retries |
| `asset.deleted` | { id, displayId } | 3 retries |
| `risk.assessed` | RiskAssessment object | 3 retries |
| `control.verified` | ControlVerification object | 3 retries |
| `incident.created` | Incident object | 5 retries (P0 event) |

## 14. Background Jobs

### 14.1 Overview
Background jobs use PostgreSQL advisory locks for cluster-safety. When multiple backend instances run simultaneously, only one instance acquires the advisory lock per job type and executes the handler; others are skipped and tracked as `skipped` in the `job_runs` table.

### 14.2 Job Types
| Job ID | Scheduler File | Schedule | Description |
|----------|---------------|----------|-------------|
| `intune-full-sync` / `intune-incremental-sync` | `backend/src/services/intune.scheduler.ts` | Configurable interval | Syncs devices from Microsoft Intune/Graph API |
| `reminder-scheduler` | `backend/src/services/reminder.scheduler.ts` | Configurable interval | Sends due reminders (e.g., due-date, risk treatment) |
| `ticket-email-gateway` | `backend/src/services/emailGateway.scheduler.ts` | Configurable interval (admin-configured mailbox poll) | Polls the inbound IMAP/Exchange Online mailbox and converts e-mails into tickets with Message-ID deduplication |
| `sla-breach-scan` | `backend/src/services/sla.scheduler.ts` | Configurable interval | Scans for SLA-breached tickets and triggers escalation notifications via SMTP |
| `ai-assistant` | `backend/src/services/ai.scheduler.ts` | Configurable interval | Runs scheduled AI assistant tasks (ticket triage notes / knowledge drafts) |

All tracked jobs run through `executeTrackedJob` (`backend/src/services/jobRunner.service.ts`), which acquires the advisory lock, records the run in `job_runs`, and marks concurrent instances as `skipped`. Webhook delivery retries are also recorded with `jobType: webhook` via `backend/src/services/webhookQueue.service.ts`.

### 14.3 Advisory Lock Mechanism
- **Lock acquisition**: `SELECT pg_try_advisory_lock(hashtext('phase10_lock_<jobId>')) AS acquired`
- **Lock release**: `SELECT pg_advisory_unlock(hashtext('phase10_lock_<jobId>')) AS released` (in finally block)
- **Key format**: `phase10_lock_<jobId>` — deterministic per job, ensuring same jobId always maps to same lock

### 14.4 JobRun Tracking
Every job execution attempt is recorded in the `job_runs` table:
| Field | Description |
|-------|-------------|
| `status` | `pending` → `running` → `completed` / `failed` / `skipped` |
| `workerId` | Identifier of the worker instance that executed (or null if skipped) |
| `attempt` | Number of execution attempts for this jobId |
| `error` | Error message on failure, null otherwise |

### 14.5 Monitoring & Troubleshooting
```sql
-- Recent job runs
SELECT * FROM job_runs ORDER BY scheduledAt DESC LIMIT 50;

-- Failed jobs
SELECT * FROM job_runs WHERE status = 'failed' ORDER BY finishedAt DESC;

-- Skipped jobs (lock contention)
SELECT * FROM job_runs WHERE status = 'skipped' ORDER BY scheduledAt DESC;
```

## Appendix C: Compliance Mapping

| Requirement ID | Feature | Implementation | Test Reference |
|---------------|---------|----------------|----------------|
| OPS-001 | Health checks | `/health/live`, `/health/ready` | `src/__tests__/phase8.health.test.ts`, `src/__tests__/phase11.health-readiness.test.ts` |
| OPS-002 | Structured logging | JSON logger middleware | `backend/src/middleware/jsonLogger.ts` |
| OPS-003 | Correlation IDs | Correlation ID middleware | `src/__tests__/phase8.correlation-id.test.ts` |
| SEC-006 | API scopes | Scope-based authorization | `src/__tests__/serviceAccount.webhook.auth.test.ts` |

> Status note (2026-10-30): corrected the test-file references; the previously cited `health.test.ts`, `jsonLogger.test.ts`, `correlationId.test.ts` and `apiScopes.test.ts` do not exist in `backend/src/__tests__/`.
