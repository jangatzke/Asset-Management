# Phase 9: Audit Log Integrity Plan

## Objective
Harden the existing `AuditLog` model with hash-chain fields for tamper-evident audit logging, enabling detection of modified or missing entries.

## Current State (Post-Phase 8)
- **Schema**: `AuditLog` table at [`backend/prisma/schema.prisma:1865`](backend/prisma/schema.prisma:1865) with fields: `id`, `timestamp`, `userId`, `userName`, `action`, `entityType`, `entityId`, `details`, `oldValue`, `newValue`, `ipAddress`, `userAgent`.
- **Service**: [`backend/src/services/audit.service.ts`](backend/src/services/audit.service.ts) — `AuditService` with `logEvent()`, `logEventStandalone()`, `queryAuditLog()`, `exportAuditLog()`, `exportAuditLogAsCSV()`.
- **Routes**: [`backend/src/routes/auditLog.routes.ts`](backend/src/routes/auditLog.routes.ts) — GET `/audit-log`, GET `/audit-log/export`, GET `/audit-log/:id` (all admin-guarded).
- **Tests**: [`backend/src/__tests__/audit.service.test.ts`](backend/src/__tests__/audit.service.test.ts) — 12 tests covering logEventStandalone, queryAuditLog, exportAuditLog.

## Changes Required

### 1. Schema Extension (`schema.prisma`)
Add three fields to `AuditLog`:
```prisma
sequence    Int      @default(0)   // monotonically increasing global sequence number
previousHash String?  @db.Text     // SHA-256 hash of previous entry (null for first entry)
entryHash   String   @db.Text      // self-hash: SHA-256(sequence, timestamp, actor, action, entity, oldValue, newValue, previousHash)
```

Also add optional `AuditCheckpoint` model for checkpoint-based verification:
```prisma
model AuditCheckpoint {
  id             String   @id @default(uuid())
  sequence       Int      // sequence at checkpoint
  hash           String   @db.Text  // entryHash at this sequence
  createdAt      DateTime @default(now())
  externalReference String? @db.VarChar(255)

  @@unique([sequence])
  @@map("audit_checkpoints")
}
```

### 2. Migration Strategy
- Since no valuable production data exists, apply a live migration that:
  1. Adds columns with defaults (`sequence = 0`, `previousHash = ''`, `entryHash = ''`)
  2. Runs a backfill to compute sequence and hashes for existing rows (if any)
  3. Sets NOT NULL constraints after backfill

### 3. Hash-Chain Implementation
**File**: [`backend/src/services/auditIntegrity.service.ts`](backend/src/services/auditIntegrity.service.ts) (new)

- `computeEntryHash(data: CanonicalAuditData): string` — deterministic SHA-256 over canonical fields
- `canonicalize(value: JsonValue): string` — stable JSON serialization using sorted keys, no whitespace
- Fields hashed: `sequence`, `timestampISO`, `userId`, `userName ?? ''`, `action`, `entityType`, `entityId`, `details ?? ''`, `oldValue ?? null`, `newValue ?? null`, `previousHash`

### 4. AuditService Integration
Modify [`backend/src/services/audit.service.ts`](backend/src/services/audit.service.ts):
- Add `sequenceCounter: number` as instance state (reset per transaction) or use DB sequence via `DisplayIdCounter` pattern
- In `logEvent()`: compute hash within the same transaction, throw on failure
- In `logEventStandalone()`: same behavior with standalone prisma client

### 5. Integrity Verification Service
**File**: [`backend/src/services/auditIntegrity.service.ts`](backend/src/services/auditIntegrity.service.ts)

```typescript
verify(prisma: PrismaClient): Promise<{ valid: boolean; brokenAtSequence?: number; details?: string }>
verifyFromSequence(prisma: PrismaClient, fromSequence: number): Promise<...>
```

- Loads all audit entries ordered by sequence ascending
- Walks the chain, recomputing each entryHash and comparing with stored value
- Returns `{ valid: true }` if entire chain is intact
- Returns `{ valid: false, brokenAtSequence: N }` if any hash mismatch or gap detected

### 6. Admin/Health Route (Optional)
Add to [`backend/src/routes/admin.routes.ts`](backend/src/routes/admin.routes.ts):
```
GET /admin/audit-integrity?fromSequence=0
```
Returns integrity status without leaking secrets. Requires admin auth.

### 7. Tests
**File**: [`backend/src/__tests__/audit.integrity.test.ts`](backend/src/__tests__/audit.integrity.test.ts) (new)
- Hash generation determinism test
- Canonicalization stability test
- Chain continuity test (sequential entries)
- Tamper detection test (modify entryHash of middle entry)
- Missing previous hash detection (first entry with non-null previousHash)
- Verify valid chain test
- Audit creation integration test (hash computed and stored correctly)

## Files Changed
| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modified | Add sequence, previousHash, entryHash to AuditLog; add AuditCheckpoint model |
| `backend/src/services/audit.service.ts` | Modified | Integrate hash computation into logEvent/logEventStandalone |
| `backend/src/services/auditIntegrity.service.ts` | New | Hash-chain utility + integrity verification service |
| `backend/src/routes/admin.routes.ts` | Modified | Add GET /admin/audit-integrity route |
| `backend/src/__tests__/audit.integrity.test.ts` | New | Integrity tests |
| `docs/phase9-audit-integrity-plan.md` | New | This plan document |

## Verification Steps
1. `cd backend && npx tsc --noEmit` — no type errors
2. `npx prisma validate` — schema valid
3. `npx prisma generate` — client regenerated
4. `npx prisma migrate dev --name phase9_audit_integrity` — migration applied
5. `npx jest src/__tests__/audit.integrity.test.ts` — integrity tests pass
6. `npx jest src/__tests__/audit.service.test.ts` — existing audit tests still pass
7. Full backend test suite passes

## Known Constraints
- No valuable production data exists; migration can safely re-sequence all rows
- Hash computation must be deterministic across runs (sorted keys, consistent null handling)
- Sequence numbers are global (not per-entity-type) to maintain a single chain
- `AuditCheckpoint` model included for future checkpoint-based verification
