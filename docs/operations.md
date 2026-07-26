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
12. [Disaster Recovery](#12-disaster-recovery)
13. [Runbook: Common Issues](#13-runbook-common-issues)

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
| Frontend | React + Vite | 5173 (dev) / 80 (prod) | UI |
| Backend | Express + TypeScript | 3000 | API Server |
| Database | PostgreSQL | 5432 | Data Store |
| Prisma ORM | — | — | Schema Management |

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/assetmgmt
JWT_SECRET=<32-char-random-string>
NODE_ENV=production|development

# Optional
PORT=3000
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
WEBHOOK_TIMEOUT_MS=10000
WEBHOOK_MAX_RETRIES=3
```

---

## 2. Health Checks & Monitoring

### Endpoints

| Endpoint | Method | Purpose | Response Time SLA |
|----------|--------|---------|-------------------|
| `/health/live` | GET | Kubernetes liveness probe | <100ms |
| `/health/ready` | GET | Kubernetes readiness probe | <500ms |
| `/metrics` | GET | Prometheus metrics | <200ms |
| `/api-info` | GET | API feature flags | <50ms |

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
Returns 200 with all checks healthy when the server is ready to serve traffic.

```json
{
  "status": "ready",
  "ready": true,
  "uptime": 86400,
  "timestamp": "2026-07-19T10:00:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "duration": 5
    },
    "webhookQueue": {
      "status": "healthy",
      "duration": 1
    }
  }
}
```

**Failure handling:** Kubernetes removes the pod from service endpoints.

### Metrics Endpoint (`/metrics`)
Prometheus-compatible metrics:

```prometheus
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/assets",status="200"} 1500
http_requests_total{method="POST",path="/api/assets",status="201"} 50

# HELP http_request_duration_ms Request duration in milliseconds
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{method="GET",path="/api/assets",le="50"} 1200
http_request_duration_ms_bucket{method="GET",path="/api/assets",le="100"} 1400
http_request_duration_ms_bucket{method="GET",path="/api/assets",le="200"} 1480
http_request_duration_ms_bucket{method="GET",path="/api/assets",le="500"} 1495
http_request_duration_ms_bucket{method="GET",path="/api/assets",le="1000"} 1500
http_request_duration_ms_bucket{method="GET",path="/api/assets",le="+Inf"} 1500

# HELP uptime_seconds Server uptime in seconds
# TYPE uptime_seconds gauge
uptime_seconds 86400

# HELP webhook_queue_size Current number of pending webhook deliveries
# TYPE webhook_queue_size gauge
webhook_queue_size 3

# HELP webhook_delivery_failures_total Total failed webhook deliveries
# TYPE webhook_delivery_failures_total counter
webhook_delivery_failures_total{event="asset.created"} 2
webhook_delivery_failures_total{event="risk.assessed"} 0
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
- **No secrets or tokens are logged.** Headers like `authorization`, `cookie`, and body fields matching patterns (`password`, `token`, `secret`, `apiKey`) are redacted.
- Request bodies are hashed (not stored) for audit purposes only.

### Log Levels
| Level | Usage | Example |
|-------|-------|---------|
| error | System errors, 5xx responses | Database connection failure |
| warn | Client errors (4xx), degraded services | Rate limit exceeded |
| info | Normal operations | Request completed successfully |
| debug | Detailed diagnostic information | Query parameters parsed |

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
    static_configs:
      - targets: ['backend:3000']
    scrape_interval: 15s
```

### Key Alerts
| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | `rate(http_requests_total{status=~"5.."}[5m]) > 0.05` | P0 |
| SlowResponse | `histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m])) > 1000` | P1 |
| DatabaseDown | `up{job="asset-management"} == 0` for 30s | P0 |
| WebhookQueueBacklog | `webhook_queue_size > 100` for 5m | P2 |

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
# 1. Stop application
kubectl rollout pause deployment/asset-mgmt-backend

# 2. Restore from backup
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME --clean --if-exists /backups/asset-mgmt-20260719.dump

# 3. Verify integrity
npx prisma migrate status --schema=backend/prisma/schema.prisma

# 4. Restart application
kubectl rollout resume deployment/asset-mgmt-backend

# 5. Run readiness check
curl -f http://localhost:3000/health/ready || echo "RESTORE FAILED"
```

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
```bash
# 1. Generate new secret (keep old one for grace period)
NEW_JWT_SECRET=$(openssl rand -base64 32)

# 2. Deploy with both secrets (dual-signing period: 24h)
kubectl set env deployment/asset-mgmt-backend \
  JWT_SECRET=$NEW_JWT_SECRET \
  JWT_SECRET_OLD=$OLD_JWT_SECRET

# 3. Wait for all pods to restart
kubectl rollout status deployment/asset-mgmt-backend

# 4. Verify all clients re-authenticated with new token
curl -s http://localhost:3000/health/ready | jq .checks

# 5. After grace period, remove old secret
kubectl set env deployment/asset-mgmt-backend JWT_SECRET_OLD-

# 6. Rotate client tokens
```

#### Service Account Token Regeneration
Via API:
```bash
curl -X POST https://api.example.com/service-accounts/{id}/regenerate-token \
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
```typescript
// src/index.ts (simplified)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal');
  
  // 1. Stop accepting new requests
  server.close();
  
  // 2. Close database connection
  await prisma.$disconnect();
  
  // 3. Drain webhook queue
  await webhookService.drainQueue();
  
  // 4. Wait for in-flight requests (max 30s)
  setTimeout(() => process.exit(1), 30000);
  
  logger.info('Graceful shutdown complete');
  process.exit(0);
}
```

### Kubernetes Pod Disruption Budget
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: asset-mgmt-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: asset-mgmt-backend
```

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
```bash
# 1. Identify last known good version
kubectl rollout history deployment/asset-mgmt-backend

# 2. Rollback to previous revision
kubectl rollout undo deployment/asset-mgmt-backend

# 3. Verify rollback
kubectl rollout status deployment/asset-mgmt-backend
curl -s http://localhost:3000/health/ready | jq .
```

---

## 12. Disaster Recovery

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

## 13. Runbook: Common Issues

### Issue: High Error Rate
```bash
# 1. Check health endpoints
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready

# 2. Check logs for correlation IDs
grep 'error' /var/log/asset-mgmt.log | tail -50

# 3. Check database connectivity
pg_isready -h $DB_HOST -p 5432

# 4. Restart if necessary
kubectl rollout restart deployment/asset-mgmt-backend
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
# 1. Check webhook queue metrics
curl http://localhost:3000/metrics | grep webhook_queue_size

# 2. List failed webhooks (via API)
curl https://api.example.com/webhooks?filter=failed \
  -H "Authorization: Bearer {token}"

# 3. Retry specific webhook delivery
curl -X POST https://api.example.com/webhooks/{id}/test \
  -H "Authorization: Bearer {token}"
```

---

## Appendix A: API Scopes Reference

| Scope | Description | Endpoints |
|-------|-------------|-----------|
| `assets:read` | View assets | GET /api/assets* |
| `assets:write` | Create/update assets | POST/PATCH/DELETE /api/assets* |
| `risks:read` | View risks | GET /api/risks* |
| `risks:write` | Manage risks | POST/PATCH/DELETE /api/risks* |
| `webhooks:read` | View webhooks | GET /api/webhooks* |
| `webhooks:write` | Manage webhooks | POST/PATCH/DELETE /api/webhooks* |
| `serviceaccounts:read` | View service accounts | GET /api/service-accounts* |
| `serviceaccounts:write` | Manage service accounts | POST/PATCH/DELETE /api/service-accounts* |
| `admin` | Full administrative access | All endpoints |

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
| Job Type | Scheduler File | Schedule | Description |
|----------|---------------|----------|-------------|
| `intune_sync` | `backend/src/services/intune.scheduler.ts` | Configurable interval | Syncs devices from Microsoft Intune/Graph API |
| `reminder_send` | `backend/src/services/reminder.scheduler.ts` | Configurable interval | Sends due reminders (e.g., due-date, risk treatment) |

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
| OPS-001 | Health checks | `/health/live`, `/health/ready` | `src/__tests__/health.test.ts` |
| OPS-002 | Structured logging | JSON logger middleware | `src/__tests__/jsonLogger.test.ts` |
| OPS-003 | Correlation IDs | Correlation ID middleware | `src/__tests__/correlationId.test.ts` |
| SEC-006 | API scopes | Scope-based authorization | `src/__tests__/apiScopes.test.ts` |
