# Phase 10: Background Jobs Cluster-Safety Plan

## Objective

Make existing background/scheduled jobs cluster-safe using PostgreSQL advisory locks and add a `JobRun` tracking model for observability. No new job queue or health/metrics endpoints are introduced in this phase.

## Current State (Post-Phase 9)

### Schedulers / Background Jobs Found

| Job | File | Trigger | Notes |
|-----|------|---------|-------|
| Intune Sync Scheduler | [`backend/src/services/intune.scheduler.ts`](backend/src/services/intune.scheduler.ts) | `setInterval` for full/incremental sync + initial full sync on startup | Runs via `initializeScheduler()` in [`backend/src/index.ts:223`](backend/src/index.ts:223). No cluster-safety; multiple instances could run concurrent syncs. |
| Reminder Scheduler | [`backend/src/services/reminder.scheduler.ts`](backend/src/services/reminder.scheduler.ts) | `setTimeout` chain, configurable interval | Runs via `initializeReminderScheduler()` in [`backend/src/index.ts:225`](backend/src/index.ts:225). Uses `running` flag but only process-local. |
| Webhook retries | [`backend/src/services/webhook.service.ts`](backend/src/services/webhook.service.ts) | `deliverWebhookWithRetry`, `broadcastEvent` called from route handlers | Not a standalone scheduler; invoked per-request. Cluster-safety not applicable (fire-and-forget per request). |
| Import runs | [`backend/src/services/import.service.ts`](backend/src/services/import.service.ts) | API-driven (`POST /imports`) | Not a background job; triggered by user action via API. No scheduler exists. |
| Reports | N/A | — | No report scheduler or service found in codebase. Documented as not applicable. |

### Schema

- PostgreSQL database, Prisma ORM.
- Existing models relevant to jobs: `ImportRun`, `IntuneSyncStatus`, `WebhookDelivery`.
- **No** existing job tracking table.

## Changes Required

### 1. New Model: `JobRun` (Prisma schema)

```prisma
model JobRun {
  id          String   @id @default(uuid())
  jobId       String   // logical job identifier, e.g. "intune-full-sync"
  jobType     String   // category: "sync", "reminder", "webhook-retry", "import"
  status      String   @default("pending") // pending | running | completed | failed | skipped
  workerId    String?  // hostname + pid or container id
  scheduledAt DateTime @default(now())
  startedAt   DateTime?
  finishedAt  DateTime?
  error       String?  @db.Text
  attempt     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([jobType, status])
  @@index([scheduledAt])
  @@map("job_runs")
}
```

### 2. Advisory Lock Service

**File**: `backend/src/services/jobLock.service.ts`

- Uses `SELECT pg_try_advisory_lock(hashtext(:lockKey))` to acquire a cluster-wide lock.
- Falls back to `SELECT pg_advisory_lock(hashtext(:lockKey))` with timeout via `pg_blocking_pids`.
- Provides `releaseLock(lockKey)` using `SELECT pg_advisory_unlock(hashtext(:lockKey))`.
- All DB operations use the shared `prisma` instance.

### 3. Tracked Job Runner

**File**: `backend/src/services/jobRunner.service.ts`

- `execute(config)` wraps: create `JobRun(pending)` → acquire advisory lock → if acquired, set `running`, execute handler, set `completed/failed`; if not acquired, set `skipped`.
- Always releases lock in `finally` block. No empty `catch {}`.

### 4. Wire Existing Schedulers

#### Intune Sync Scheduler (`intune.scheduler.ts`)

- Wrap each sync run (full and incremental) with the tracked job runner:
  - `jobId`: `"intune-full-sync"` / `"intune-incremental-sync"`
  - `jobType`: `"sync"`
  - Lock key: `"phase10_intune_sync"`

#### Reminder Scheduler (`reminder.scheduler.ts`)

- Wrap `runOnce()` with the tracked job runner:
  - `jobId`: `"reminder-scheduler"`
  - `jobType`: `"reminder"`
  - Lock key: `"phase10_reminder_scheduler"`

#### Webhook Service

- Not a standalone scheduler. Document as **not applicable** for advisory locks (per-request invocation).

#### Import Runs

- No background scheduler exists. Document as **not applicable**.

#### Reports

- No report scheduler/service found. Document as **not applicable**.

### 5. Idempotency Notes

- Intune sync already uses `upsert` for assets and `intuneDeviceSync` records — idempotent by design.
- Reminder scheduler checks `dueAt` threshold — repeated execution produces no duplicate reminders.
- Webhook deliveries are per-request; the `WebhookDelivery` table ensures each delivery is unique.

### 6. Tests

**File**: `backend/src/__tests__/phase10.job-cluster-safety.test.ts`

Tests:
1. Advisory lock acquired → job runs and completes.
2. Lock unavailable (simulated) → job skipped, status recorded as `skipped`.
3. Lock released on success (verify `pg_advisory_unlock` called).
4. Lock released on failure (handler throws).
5. Job status/attempt/error recorded in `JobRun`.
6. Two simulated workers — only one executes logic; second is skipped.

### 7. Documentation Updates

- [`docs/requirements.md`](docs/requirements.md): Add Phase 10 requirement entry.
- [`docs/compliance-matrix.yml`](docs/compliance-matrix.yml): Add Phase 10 entries.
- [`docs/implementation-log.md`](docs/implementation-log.md): Log Phase 10 completion.
- [`docs/operations.md`](docs/operations.md): Document job tracking and cluster-safety behavior.

## Constraints

- No full new job queue implementation.
- No readiness/health/metrics endpoints.
- No CI gates, compliance docs rewrite, broad code-quality refactor, or new ISMS modules.
- No empty `catch {}`; no unbounded `any` without documentation.
- Windows/PowerShell-compatible commands only.

## Verification Checklist

- [ ] Backend builds (`npm run build`)
- [ ] Shared builds pass
- [ ] Frontend builds
- [ ] Prisma validate/migrate deploy/status pass
- [ ] Backend Jest tests pass (545+)
- [ ] Frontend tests pass
- [ ] Workspace lint pass (warnings only acceptable)
