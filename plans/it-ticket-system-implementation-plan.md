# IT Ticket System ‒ Implementation Plan

> **Scope:** Planning only. No code, schema, or migration files are modified by this document.
> **Deliverable:** A single, phased implementation plan to add a generic IT ticket system to the Asset Management ISMS application, generalizing the existing **Incident** domain into a **Ticket** entity with a `type` field, aligned to **ITIL 4**, **ISO/IEC 27001:2022**, and **EU NIS2 (2022/2555)**.

---

## 0. Normative Sources & Tooling Note

The `context7` MCP server was **unavailable** for this task. All framework/standard content below is drawn from built-in knowledge of the cited normative sources. No library-specific code was generated from live documentation.

| Source | Used for |
|--------|----------|
| **ITIL 4 Foundation** (AXELOS / PeopleCert) | Ticket types (incident, problem, request fulfillment, change enablement), RACI, SLA, urgency/impact/priority, CAB, state machines |
| **ISO/IEC 27001:2022 Annex A** | A.5.24 (incident management), A.5.26 (ICT resilience), A.8.15 (logging), A.8.16 (monitoring activities) |
| **EU NIS2 Directive 2022/2555** (Art. 23) | Incident reporting obligations & timelines: 24h early warning, 72h notification, final report |
| **ISO/IEC 27035** (Information security incident management) | Incident lifecycle & classification (supporting reference) |

---

## 1. Context ‒ What Exists Today

The repository is a monorepo with three packages:

- `Asset-Management/frontend` ‒ React 18 + Vite + Tailwind + react-router, i18n via `I18nContext`.
- `Asset-Management/backend` ‒ Node/Express + Prisma (PostgreSQL), Zod DTO validation, JWT auth, RBAC.
- `Asset-Management/shared` ‒ shared TS types, Zod DTOs, and the **single-source-of-truth transition matrices** consumed by both backend and frontend.

### 1.1 The existing Incident domain (deeply NIS2/ISO27001-specific)

The `Incident` model ([`backend/prisma/schema.prisma:1606`](Asset-Management/backend/prisma/schema.prisma:1606), `@@map("incidents")`) is **not** a generic IT ticket. It carries a large NIS2/ISO27001-specific surface:

- **CIA / impact fields:** `confidentialityImpact`, `integrityImpact`, `availabilityImpact`, `operationalImpact`, `financialImpact`, `legalImpact`, `personalDataImpact`.
- **NIS2 significance & reporting:** `nis2Relevant`, `nis2Severity` (`not_assessed`/`early_warning`/`notification`/`final`), `nis2ReportedAt`, `nis2ReportDeadline`, `nis2FinalReportDue`, `isSignificant`, `significanceReasons[]`, `significanceRuleVersionId`, `notificationStatus`.
- **Knowledge-time tracking:** `detectionTime`, `knowledgeTime`, plus `IncidentKnowledgeTimeChange` history.
- **1:1 assessment:** `IncidentAssessment` (`isReportable`, `decisionNotToReport`, `decisionApprovedBy/At`).
- **Deadlines:** `NotificationDeadline` (unique per `[incidentId, notificationType]`).
- **Reports/communications/escalations:** `IncidentReport`, `IncidentCommunication`, `IncidentEscalation`.
- **Tamper-evident history:** `IncidentHistoryEntry` (AUD-001 pattern: `action`, `fieldChanges`, `summary`, `actorId`, `ipAddress`, `userAgent`).
- **Impact links:** `IncidentAsset`, `IncidentService`, `IncidentProcess` junction tables (also referenced from `Asset.incidents`, `BusinessService`, `BusinessProcess`).

Shared types live in [`shared/src/types/incident.ts`](Asset-Management/shared/src/types/incident.ts) (`IncidentStatus`, `IncidentSeverity`, `NotificationStatus`, `IncidentReportType`). The incident state machine is the single source of truth in [`shared/src/incidentTransitions.ts`](Asset-Management/shared/src/incidentTransitions.ts):

```
new -> under_investigation | contained | resolved
under_investigation -> new | contained | resolved
contained -> under_investigation | resolved
resolved (terminal) ; closed (only via gated /close)
```

The backend consumes it in [`backend/src/services/statusTransition.ts:42`](Asset-Management/backend/src/services/statusTransition.ts:42) (wrapped into `transitionMatrix.incidents`) and the frontend in `IncidentDetail.tsx`.

### 1.2 REST conventions (from `incident.routes.ts`)

[`backend/src/routes/incident.routes.ts`](Asset-Management/backend/src/routes/incident.routes.ts) establishes the conventions the ticket system must follow:

- Middleware chain: `authenticate` + one of `requirePermission(<perm>)`, `authorizeEntityWrite('<entity>')`, `authorizeEntityDelete('<entity>')`, or `requireEntityPermission('<perm>', '<entity>')`, plus `validateBody(<ZodSchema>)` (schemas imported from `shared`).
- List endpoints combine a read permission with `authorizationService.buildReadFilter(userId, '<entity>')` for scope filtering.
- A **dedicated status transition endpoint** `POST /:id/status` (not a generic PUT) with a `ChangeIncidentStatusSchema`.
- Gated terminal actions: `POST /:id/close` (`incidents.close`), `POST /:id/assess` (`incidents.assess`), `POST /:id/reports` (`incidents.report`), `POST /:id/non-reportable-approval` (`nis2.approve`).
- Per-entity audit history: `GET /:id/history`.

### 1.3 RBAC model (existing, to be extended)

- **Roles:** `system_admin`, `ism_manager`, `auditor`, `employee` seeded in [`backend/prisma/seed.ts:46`](Asset-Management/backend/prisma/seed.ts:46) with `isBuiltIn`, `canAccessAdmin`, and a legacy `entityPermissions` JSON (`none|readonly|readwrite` per entity).
- **Granular permissions:** the authoritative catalog is `GRANULAR_PERMISSIONS` in [`backend/src/services/authorization.service.ts:5`](Asset-Management/backend/src/services/authorization.service.ts:5) (e.g. `incidents.read`, `incidents.write`, `incidents.assess`, `incidents.report`, `incidents.close`). These are materialized as `Permission` rows and linked via `RolePermission`.
- **Assignment:** `UserRole` (direct) and `Group`/`GroupRole` (indirect), each optionally scoped by `legalEntityId`/`organizationUnitId`/`scopeId`/`siteId` with `validFrom`/`validUntil`.
- **Decision engine:** `AuthorizationService` ([`authorization.service.ts:106`](Asset-Management/backend/src/services/authorization.service.ts:106)) provides `can`, `canForEntity`, `require`, `requireForEntity`, `buildReadFilter`, `permissionForAction`. Effective permissions are derived from `RolePermission` rows (the `Role.permissions` JSON is legacy; `system_admin` is a bootstrap exception that gains all permissions).
- **Entity scoping:** `resolveEntityScope` and `buildScopedFilter` currently handle `assets`, `risks`, `controls`, `incidents` (via `incidentAssets -> asset`). Adding `tickets` requires extending these.
- **Middleware:** [`backend/src/middleware/entityAuth.ts`](Asset-Management/backend/src/middleware/entityAuth.ts) exposes `authorizeEntity*`, `requirePermission`, `requireEntityPermission`, `requireAdminAccess`.

### 1.4 Reusable infrastructure

- **`DisplayIdCounter`** ‒ sequential display IDs per `entityType` (format `PREFIX-NNNN`). Reused for ticket IDs.
- **`AuditLog` + `AuditCheckpoint`** ‒ Phase 9 hash-chain tamper-evident logging ([`docs/phase9-audit-integrity-plan.md`](Asset-Management/docs/phase9-audit-integrity-plan.md)). All ticket mutations must flow through `AuditService` with `entityType: 'ticket'`.
- **`EntityHistoryEntry`** ‒ generic non-incident history (`entityType`, `entityId`, `action`, `fieldChanges`, `actorId`, `actorName`); the pattern for per-ticket history.
- **Generic workflow engine** ‒ `WorkflowDefinition`/`WorkflowInstance`/`WorkflowTask`/`WorkflowTransitionLog` exist and *could* host ticket workflows, but the codebase's established pattern for domain lifecycles is the **shared transition-matrix** approach (used for incidents, corrective actions, BIA/BCP, etc.). We follow the established pattern for consistency.

### 1.5 Frontend conventions

- Routing in [`frontend/src/App.tsx:55`](Asset-Management/frontend/src/App.tsx:55) (lazy pages under `<Layout>`).
- Navigation in [`frontend/src/components/Layout.tsx:85`](Asset-Management/frontend/src/components/Layout.tsx:85) (icon + label, i18n keys, admin-gated items).
- Incident list/detail: [`frontend/src/pages/Incidents.tsx`](Asset-Management/frontend/src/pages/Incidents.tsx), [`frontend/src/pages/IncidentDetail.tsx`](Asset-Management/frontend/src/pages/IncidentDetail.tsx), helpers [`incidentStatusHelpers.ts`](Asset-Management/frontend/src/pages/incidentStatusHelpers.ts).
- API client: [`frontend/src/services/api.ts`](Asset-Management/frontend/src/services/api.ts) (`incidentApi`, concrete DTO types).
- Auth/role access: `useAuthStore` (`user.roles`), i18n via `useI18n`.

### 1.6 Testing conventions

- **Backend:** Jest + `ts-jest` ([`backend/jest.config.js`](Asset-Management/backend/jest.config.js)), `shared` mapped to `shared/dist`, `prisma-mock` + `setup.ts` in `src/test/`. Tests colocated in `src/__tests__/*.test.ts` and `src/**/*.test.ts`.
- **Frontend:** Vitest + React Testing Library for page/component tests (e.g. `IncidentDetail.status.test.ts`), **Playwright** for e2e (`frontend/e2e/*.spec.ts`, `frontend/playwright.config.ts`).

---

## 2. Data Model Design

### 2.1 Decision: **Option (b) ‒ create a new `Ticket` table and migrate incidents**

We **do not** rename `incidents` to `tickets`. Instead we introduce a new generic `tickets` table as the ITIL container, and keep the existing `incidents` table as a **1:1 extension** for the `incident` ticket type.

**Rationale:**

1. **No schema pollution.** The `incidents` table holds ~25 NIS2/ISO27001-specific columns (significance, knowledge time, CIA impact, reporting deadlines). Renaming it to `tickets` would force every service request, problem, and change row to carry a wall of null incident-only columns. A generic `tickets` base + a typed `incidents` extension keeps each table clean.
2. **Zero regression risk to the live NIS2 pipeline.** The existing significance-rule engine, deadline recalculation, knowledge-time protection, and reporting endpoints (`/incidents/*`) are unchanged in behavior. They operate on the same `incidents` rows, now linked 1:1 to a `tickets` row.
3. **Clean ITIL generalization.** `tickets` holds only the fields common to all ITIL ticket types (type, status, priority/urgency/impact, SLA, requester/assignee, comments, asset links, cross-links). Type-specific data lives in extension tables.
4. **Backward compatibility is trivial.** `/incidents/*` becomes a filtered view over `tickets` where `type = 'incident'`, joined to the `incidents` extension. Existing display IDs, history, and audit records remain intact.

### 2.2 New / modified Prisma models

> All new tables are additive. The only change to an existing table is adding a nullable, unique `ticketId` FK on `incidents` (plus backfill). No existing column is renamed or dropped.

```prisma
// ---- Generic ITIL ticket container ----------------------------------------
model Ticket {
  id            String    @id @default(uuid())
  displayId     String    @unique          // e.g. TCKT-0001 (per-type prefix via DisplayIdCounter)
  type          String                       // 'incident' | 'service_request' | 'problem' | 'change'
  title         String
  description   String?
  status        String    @default("new")    // per-type state machine (shared ticketTransitions)
  priority      String    @default("medium") // low | medium | high | critical
  urgency       String    @default("medium") // low | medium | high | critical
  impact        String    @default("medium") // low | medium | high | critical

  // Requester / ownership (ITIL: requester, assigned engineer, manager)
  requesterId   String?
  assigneeId    String?
  managerId     String?

  // SLA (ITIL: target from priority+type; breach detection)
  slaTargetAt      DateTime?
  firstResponseAt  DateTime?
  firstResponseDueAt DateTime?
  resolutionDueAt  DateTime?
  slaBreachedAt    DateTime?

  // Lifecycle
  openedAt      DateTime  @default(now())
  resolvedAt    DateTime?
  closedAt      DateTime?
  closedBy      String?
  version       Int       @default(1)
  isArchived    Boolean   @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String?
  updatedBy String?

  // Relations
  assets      TicketAsset[]
  comments    TicketComment[]
  linksFrom   TicketLink[]      @relation("TicketLinkFrom")
  linksTo     TicketLink[]      @relation("TicketLinkTo")
  incident    Incident?          // 1:1 extension for type='incident'
  problem     Problem?           // 1:1 extension for type='problem'
  change      Change?            // 1:1 extension for type='change'
  serviceRequest ServiceRequest? // 1:1 extension for type='service_request'
  history     TicketHistoryEntry[]

  @@index([type, status])
  @@index([assigneeId, status])
  @@index([slaTargetAt])
  @@map("tickets")
}

// ---- Generic asset link (all ticket types) --------------------------------
model TicketAsset {
  ticketId String
  assetId  String
  ticket  Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  asset   Asset  @relation(fields: [assetId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@id([ticketId, assetId])
  @@map("ticket_assets")
}

// ---- Comments / updates (internal notes vs. user-visible) ------------------
model TicketComment {
  id        String   @id @default(uuid())
  ticketId  String
  authorId  String?
  body      String
  isInternal Boolean @default(false)  // true = agent note, hidden from requester
  createdAt DateTime @default(now())
  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  @@index([ticketId, createdAt])
  @@map("ticket_comments")
}

// ---- Cross-ticket links (ITIL incident<->problem<->change, duplicates) -----
model TicketLink {
  id          String @id @default(uuid())
  fromTicketId String
  toTicketId   String
  linkType    String   // 'caused_by_problem' | 'resolved_by_change' | 'related_incident' | 'duplicate_of'
  createdAt   DateTime @default(now())
  fromTicket  Ticket @relation("TicketLinkFrom", fields: [fromTicketId], references: [id], onDelete: Cascade)
  toTicket    Ticket @relation("TicketLinkTo",   fields: [toTicketId],   references: [id], onDelete: Cascade)
  @@unique([fromTicketId, toTicketId, linkType])
  @@map("ticket_links")
}

// ---- Per-ticket tamper-evident history (AUD-001 pattern) --------------------
model TicketHistoryEntry {
  id           String   @id @default(uuid())
  ticketId     String
  action       String   // CREATE|UPDATE|DELETE|STATUS_CHANGE|ASSIGN|COMMENT|CLOSE|ESCALATE|LINK
  fieldChanges Json?
  summary      String?
  actorId      String?
  actorName    String?
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime @default(now())
  ticket       Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  @@index([ticketId, createdAt])
  @@map("ticket_history_entries")
}

// ---- Ticket type configuration (extensible types + SLA policy) --------------
model TicketTypeConfig {
  id            String   @id @default(uuid())
  type          String   @unique   // 'incident' | 'service_request' | 'problem' | 'change'
  label         String
  description   String?
  enabled       Boolean  @default(true)
  slaPolicy     Json?    // { byPriority: { low: { resolutionHours: 240, firstResponseHours: 24 }, ... } }
  defaultPriority String @default("medium")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@map("ticket_type_configs")
}

// ---- Service catalog (request fulfillment: catalog items / request types) ---
model ServiceCatalogItem {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  description String?
  ticketType  String   @default("service_request")
  fulfillment Json?    // { requestedBy: 'employee'|'it', approverRole: 'it_manager', slaHours: 48 }
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@map("service_catalog_items")
}
```

### 2.3 Type-specific extension tables

```prisma
// ---- Incident extension (existing `incidents` table, now linked 1:1) --------
// Add to the EXISTING Incident model:
model Incident {
  // ... all existing NIS2/ISO27001 fields unchanged ...
  ticketId String? @unique
  ticket   Ticket? @relation(fields: [ticketId], references: [id], onDelete: SetNull)
  // ... existing relations unchanged ...
}

// ---- Problem extension (ITIL problem management) ----------------------------
model Problem {
  id            String   @id @default(uuid())
  ticketId      String   @unique
  ticket        Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  rootCause     String?
  workaround    String?
  permanentFix  String?
  relatedIncidentIds String[]  // denormalized convenience; canonical links via TicketLink
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@map("problems")
}

// ---- Change extension (ITIL change enablement) ------------------------------
model Change {
  id            String   @id @default(uuid())
  ticketId      String   @unique
  ticket        Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  changeType    String   @default("standard")  // standard | normal | emergency
  riskLevel     String   @default("low")
  cabApproved   Boolean  @default(false)
  cabApprovedBy String?
  cabApprovedAt DateTime?
  implementationPlan String?
  rollbackPlan     String?
  backoutDate      DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@map("changes")
}

// ---- Service request extension (ITIL request fulfillment) -------------------
model ServiceRequest {
  id            String   @id @default(uuid())
  ticketId      String   @unique
  ticket        Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  catalogItemId String?
  catalogItem   ServiceCatalogItem? @relation(fields: [catalogItemId], references: [id])
  fulfillmentStatus String @default("pending") // pending | in_fulfillment | delivered | rejected
  deliveredAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@map("service_requests")
}
```

> `Asset` gains a `ticketLinks TicketAsset[]` relation (mirroring the existing `incidents IncidentAsset[]`). `ServiceCatalogItem` gains `serviceRequests ServiceRequest[]`.

### 2.4 Display IDs

Reuse `DisplayIdCounter` with per-type `entityType` keys so IDs are meaningful per ITIL type:

| Ticket type | `entityType` key | Example display ID |
|-------------|------------------|--------------------|
| incident | `ticket:incident` | `INC-0001` |
| service_request | `ticket:service_request` | `REQ-0001` |
| problem | `ticket:problem` | `PRB-0001` |
| change | `ticket:change` | `CHG-0001` |

Existing incident display IDs continue to be honored; the migration (Phase 2) backfills `DisplayIdCounter['ticket:incident']` to `max(existing incident sequence)` so new tickets don't collide.

### 2.5 Migration strategy (incident data)

A single additive migration `2026MMDDHHMMSS_it_ticket_system`:

1. Create `tickets`, `ticket_assets`, `ticket_comments`, `ticket_links`, `ticket_history_entries`, `ticket_type_configs`, `service_catalog_items`, `problems`, `changes`, `service_requests`.
2. Add nullable unique `incidents.ticketId`.
3. **Backfill (idempotent, transactional):** for every existing `incidents` row, insert a `tickets` row (`type='incident'`, `status` = incident status, `priority` mapped from incident `severity`, `requesterId` = `reporterId`, `assigneeId` = `incidentManagerId`, `openedAt` = `detectionTime`, `displayId` = incident `displayId`), then set `incidents.ticketId`. Seed `ticket_type_configs` (4 rows) and a starter `service_catalog_items` set.
4. Backfill `DisplayIdCounter['ticket:incident']` to the max existing incident sequence.
5. No destructive changes; rollback = drop new tables + column.

---

## 3. ITIL 4 Alignment

### 3.1 Ticket types

| `type` | ITIL 4 practice | Purpose |
|--------|-----------------|----------|
| `incident` | Incident Management | Restore normal service operation after an unplanned interruption (the existing security-incident domain) |
| `service_request` | Request Fulfillment | Predefined, often catalog-driven requests (access, hardware, information) |
| `problem` | Problem Management | Root-cause investigation of one or more incidents |
| `change` | Change Enablement | Any change to a configuration item (standard/normal/emergency, CAB-gated) |

### 3.2 Per-type state machines (shared single source of truth)

New file [`shared/src/ticketTransitions.ts`](Asset-Management/shared/src/ticketTransitions.ts) following the exact pattern of [`shared/src/incidentTransitions.ts`](Asset-Management/shared/src/incidentTransitions.ts):

```typescript
export const TICKET_TRANSITIONS: Readonly<Record<TicketType, Readonly<Record<string, readonly string[]>>>> = {
  incident: INCIDENT_TRANSITIONS, // reuse existing incident matrix verbatim
  service_request: {
    new: ['in_progress', 'pending', 'on_hold', 'cancelled'],
    in_progress: ['pending', 'on_hold', 'fulfilled', 'cancelled'],
    pending: ['in_progress', 'on_hold', 'cancelled'],
    on_hold: ['in_progress', 'cancelled'],
    // 'fulfilled' and 'cancelled' are terminal
  },
  problem: {
    new: ['investigating', 'cancelled'],
    investigating: ['identified', 'cancelled'],
    identified: ['workaround', 'resolved', 'cancelled'],
    workaround: ['resolved', 'cancelled'],
    // 'resolved' terminal; 'closed' via gated action
  },
  change: {
    draft: ['assessment', 'cancelled'],
    assessment: ['approval', 'rejected', 'cancelled'],
    approval: ['approved', 'rejected', 'cancelled'],
    approved: ['in_progress', 'cancelled'],
    in_progress: ['implemented', 'cancelled'],
    implemented: ['reviewing', 'closed'],
    reviewing: ['closed', 'in_progress'],
    // 'closed', 'rejected', 'cancelled' terminal
  },
};

export function getAllowedTicketTransitions(type: TicketType, currentStatus: string): string[] {
  const matrix = TICKET_TRANSITIONS[type];
  const targets = matrix?.[currentStatus];
  return targets ? Array.from(targets) : [];
}
```

The backend registers these in [`backend/src/services/statusTransition.ts:168`](Asset-Management/backend/src/services/statusTransition.ts:168) under a new `tickets` key (keyed by `type`), and the frontend drives transition buttons from the same matrix. **`incident` reuses `INCIDENT_TRANSITIONS` unchanged**, preserving NIS2 behavior.

### 3.3 Priority / Urgency / Impact

- `urgency` and `impact` each `low|medium|high|critical`; `priority` is derived (and also stored) via the ITIL priority matrix:

| Priority | Urgency High | Urgency Medium | Urgency Low |
|----------|--------------|----------------|-------------|
| **Impact High** | Critical | High | Medium |
| **Impact Medium** | High | Medium | Low |
| **Impact Low** | Medium | Low | Low |

A shared helper `computePriority(urgency, impact)` lives in `shared` and is used by both the create DTO default and the UI.

### 3.4 SLA fields & policy

- Stored on `Ticket`: `slaTargetAt`, `firstResponseDueAt`, `resolutionDueAt`, `firstResponseAt`, `slaBreachedAt`.
- `TicketTypeConfig.slaPolicy` (JSON) defines target hours per priority per type. On create, the service computes `firstResponseDueAt`/`resolutionDueAt` from the policy; a background/`escalations/run-overdue`-style job (reusing the existing escalation runner pattern) sets `slaBreachedAt` when the target passes while the ticket is open.

### 3.5 RACI (per ticket action)

| Action | Service Desk Agent | IT Manager | Service Catalog Manager | Ticket Viewer | Auditor |
|--------|:--:|:--:|:--:|:--:|:--:|
| Create ticket | **R** | A | C (catalog items) | I | I |
| Triage / assign | **R** | A | I | I | I |
| Update / comment | **R** | A | I | I | I |
| Status transition | **R** | A | I | I | I |
| Close | C | **A/R** (gated) | I | I | I |
| Escalate | R | **A** | I | I | I |
| Approve change (CAB) | C | **A/R** | I | I | I |
| Manage catalog / SLA policy | I | C | **A/R** | I | I |
| Read (scoped) | R | R | R | **R** | **R** (read-only) |

(R = Responsible, A = Accountable, C = Consulted, I = Informed.) This maps directly to the permission set in Section 5.

### 3.6 Escalation

Reuse the existing `IncidentEscalation` pattern generalized to `Ticket`: an `escalate` action records reason, target role/level, and `dueAt`; the overdue runner (existing `POST /incidents/escalations/run-overdue` pattern) flags overdue tickets. Escalation is permission-gated (`tickets.escalate`).

### 3.7 Cross-ticket linkage (incident ⇄ problem ⇄ change)

- `TicketLink` with `linkType` `caused_by_problem`, `resolved_by_change`, `related_incident`, `duplicate_of`.
- ITIL flow: an **incident** can be marked `caused_by_problem` (a **problem**); a **problem** can be `resolved_by_change` (a **change**). The UI surfaces these links on the ticket detail (similar to the existing incident `serviceLinks`/`processLinks` panels).

### 3.8 Audit logging (tied to Phase 9)

Every ticket mutation (create, update, status change, assign, comment, close, escalate, link) is logged via `AuditService` with `entityType: 'ticket'` (feeding the Phase 9 hash chain) **and** a `TicketHistoryEntry` (per-ticket trail, AUD-001 pattern, mirroring `IncidentHistoryEntry`). `GET /tickets/:id/history` returns the per-ticket trail.

---

## 4. ISO 27001 / NIS2 Alignment

| Control | Requirement | How the ticket system supports it |
|---------|-------------|-----------------------------------|
| **A.5.24** Incident management | Defined roles, documented process, timely response | Ticket lifecycle with RACI, priority/SLA, escalation, full audit trail; `incident` type preserves the existing NIS2 significance + reporting pipeline unchanged |
| **A.5.26** ICT resilience | Service continuity, incident/DR coordination | `service_request` + `change` types give a single system of record for resilience-related requests and changes; cross-links tie incidents to the changes that resolve them |
| **A.8.15** Logging | Tamper-evident, complete logs | All ticket events through `AuditService` (Phase 9 hash chain) + `TicketHistoryEntry` |
| **A.8.16** Monitoring activities | Detection & response visibility | SLA breach tracking, overdue escalation runner, status/severity dashboards |

**NIS2 (Art. 23) timelines** remain fully on the `incident` type (unchanged): 24h early warning, 72h notification, final report, driven by the existing `IncidentAssessment`/`NotificationDeadline`/knowledge-time machinery. The new `Ticket.slaTargetAt`/`slaBreachedAt` fields provide a **generic** SLA view for non-incident types without touching the NIS2 deadline logic.

**Compliance-matrix mapping** (see Section 10): existing `INC-001` (incident assessment & deadlines) is retained; new `TCKT-*` entries cover the generic ticket system. The `incident` type's NIS2 coverage is explicitly cross-referenced so auditors can trace incident reporting to both `INC-*` and `TCKT-*` entries.

---

## 5. Permission Roles (RBAC integration)

### 5.1 New granular permissions

Add to `GRANULAR_PERMISSIONS` in [`backend/src/services/authorization.service.ts:5`](Asset-Management/backend/src/services/authorization.service.ts:5) (exact strings follow the existing `entity.action` convention):

```
tickets.read, tickets.write, tickets.close, tickets.escalate, tickets.approve, tickets.manage
serviceCatalog.read, serviceCatalog.manage
```

### 5.2 New built-in roles

Seeded in [`backend/prisma/seed.ts`](Asset-Management/backend/prisma/seed.ts) (mirroring the existing `ROLE_PERMISSIONS` + `seedRoles` pattern), each with `isBuiltIn: true` and a legacy `entityPermissions` entry `tickets: 'readonly'|'readwrite'` for backward compatibility:

| Role | Granular permissions | `entityPermissions.tickets` | Description |
|------|----------------------|------------------------------|-------------|
| `ticket_viewer` | `tickets.read`, `serviceCatalog.read` | `readonly` | Read-only, scoped view of tickets & catalog |
| `service_desk_agent` | `tickets.read`, `tickets.write` | `readwrite` | Create/update/assign/transition/comment tickets |
| `it_manager` | `tickets.read`, `tickets.write`, `tickets.close`, `tickets.escalate`, `tickets.approve` | `readwrite` | Full ticket ops incl. close, escalate, CAB approval |
| `service_catalog_manager` | `tickets.read`, `serviceCatalog.read`, `serviceCatalog.manage` | `readonly` | Manages catalog items & SLA policy |
| `auditor` (existing) | **add** `tickets.read` to its list | `readonly` | Read-only audit access to tickets |

`system_admin` / `ism_manager` automatically gain all new permissions (bootstrap exception + `GRANULAR_PERMISSIONS` spread).

### 5.3 `AuthorizationService` extensions

- Add `'tickets'` to the `EntityType` union ([`authorization.service.ts:24`](Asset-Management/backend/src/services/authorization.service.ts:24)).
- Add `tickets: 'tickets.write'` to `WRITE_PERMISSION_BY_RESOURCE` and `tickets: 'tickets.read'` to `READ_PERMISSION_BY_RESOURCE`.
- Extend `resolveEntityScope` and `buildScopedFilter` for `'tickets'` using `ticketAssets -> asset` (identical shape to the existing `'incidents'` branch, which uses `incidentAssets`).
- `permissionForAction` already resolves `tickets.read`/`tickets.write`/`tickets.<action>` generically once the strings are in `GRANULAR_PERMISSIONS`.

### 5.4 Middleware usage

New ticket routes use the existing factories from [`entityAuth.ts`](Asset-Management/backend/src/middleware/entityAuth.ts): `requirePermission('tickets.read')`, `authorizeEntityWrite('tickets')`, `requireEntityPermission('tickets.close', 'tickets')`, etc. **No new middleware is required.**

---

## 6. API Design

All routes mounted at `/api/v1/tickets` (and `/api/v1/ticket-types`, `/api/v1/service-catalog`) in [`backend/src/index.ts`](Asset-Management/backend/src/index.ts), following `incident.routes.ts` conventions exactly. New file: [`backend/src/routes/ticket.routes.ts`](Asset-Management/backend/src/routes/ticket.routes.ts); new service: [`backend/src/services/ticket.service.ts`](Asset-Management/backend/src/services/ticket.service.ts).

### 6.1 Endpoints & permission checks

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/tickets` | `tickets.read` + `buildReadFilter('tickets')` | List; filters: `type`, `status`, `priority`, `assigneeId`, `search`, pagination |
| POST | `/tickets` | `tickets.write` | Create; Zod `CreateTicketSchema`; computes display ID + SLA; creates type extension row |
| GET | `/tickets/:id` | `requireEntityPermission('tickets.read','tickets')` | Detail incl. extension, assets, links, SLA |
| PUT | `/tickets/:id` | `authorizeEntityWrite('tickets')` | Update core fields (not status) |
| DELETE | `/tickets/:id` | `tickets.manage` | Soft-archive preferred; hard delete admin-only |
| POST | `/tickets/:id/status` | `authorizeEntityWrite('tickets')` | Gated transition via `ChangeTicketStatusSchema` + `validateTransition('tickets', type, from, to)` |
| POST | `/tickets/:id/assign` | `tickets.write` | Set `assigneeId` |
| POST | `/tickets/:id/comments` | `tickets.write` | `isInternal` flag |
| POST | `/tickets/:id/close` | `requireEntityPermission('tickets.close','tickets')` | Gated; sets `closedAt`/`closedBy` |
| POST | `/tickets/:id/escalate` | `requireEntityPermission('tickets.escalate','tickets')` | Records escalation |
| POST | `/tickets/:id/links` | `tickets.write` | Add `TicketLink` |
| GET | `/tickets/:id/comments` | `requireEntityPermission('tickets.read','tickets')` | Comment list |
| GET | `/tickets/:id/history` | `requireEntityPermission('tickets.read','tickets')` | `TicketHistoryEntry` trail |
| GET | `/ticket-types` | `tickets.read` | List `TicketTypeConfig` |
| POST | `/ticket-types` | `tickets.manage` | Create type config |
| PUT | `/ticket-types/:type` | `tickets.manage` | Update SLA policy / enabled |
| GET | `/service-catalog` | `serviceCatalog.read` | List catalog items |
| POST | `/service-catalog` | `serviceCatalog.manage` | Create item |
| PUT | `/service-catalog/:id` | `serviceCatalog.manage` | Update item |
| DELETE | `/service-catalog/:id` | `serviceCatalog.manage` | Disable/delete item |

### 6.2 Request/response shapes (representative)

```typescript
// shared/src/dtos/ticket.ts (new, Zod)
CreateTicketSchema = z.object({
  type: z.enum(['incident','service_request','problem','change']),
  title: z.string().min(1),
  description: z.string().optional(),
  urgency: z.enum(['low','medium','high','critical']).optional(),
  impact:  z.enum(['low','medium','high','critical']).optional(),
  priority: z.enum(['low','medium','high','critical']).optional(), // defaults from urgency+impact
  requesterId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  assetIds: z.array(z.string().uuid()).default([]),
  // type-specific payloads (validated per type):
  incident: IncidentExtensionSchema.optional(),
  problem: ProblemExtensionSchema.optional(),
  change: ChangeExtensionSchema.optional(),
  serviceRequest: ServiceRequestExtensionSchema.optional(),
});

ChangeTicketStatusSchema = z.object({
  status: z.string().min(1),
  justification: z.string().optional(),
});
```

Response for `GET /tickets/:id` returns the `Ticket` core plus the matching extension object, `assets[]`, `links[]`, `sla` block, and a `transitions` array (allowed next statuses from the shared matrix) so the UI can render valid actions without a second call.

### 6.3 Backward compatibility of `/incidents`

- **Keep all existing `/incidents/*` endpoints** as a **filtered view** over `tickets` where `type='incident'`, joined to the `incidents` extension. The `incident.service.ts` layer is updated to read/write through the `ticket`+`incident` pair but the **public contract, permission strings (`incidents.*`), and NIS2 behavior are unchanged**.
- `GET /incidents` maps each incident to its parent ticket for `displayId`/SLA but returns the same incident payload shape as today.
- This avoids breaking the existing frontend `Incidents.tsx`/`IncidentDetail.tsx` and any external consumers.

---

## 7. Frontend Design

### 7.1 New pages & routes

| Route | Page | File |
|-------|------|------|
| `/tickets` | Ticket list (all types, filterable) | `frontend/src/pages/Tickets.tsx` |
| `/tickets/new` | New ticket (type selector + type-specific form) | `frontend/src/pages/NewTicket.tsx` |
| `/tickets/:ticketId` | Ticket detail (core + extension + comments + links + history) | `frontend/src/pages/TicketDetail.tsx` |

Registered in [`frontend/src/App.tsx:55`](Asset-Management/frontend/src/App.tsx:55) as lazy imports. Existing `/incidents` and `/incidents/:incidentId` routes **remain** (now backed by the same data).

### 7.2 Navigation

Add a `Tickets` item to the `navigation` array in [`frontend/src/components/Layout.tsx:85`](Asset-Management/frontend/src/components/Layout.tsx:85) (icon `QueueListIcon` or `ClipboardDocumentListIcon`, i18n key `navigation.tickets`). Add `navigation.tickets` to the locale files under `frontend/src/locales/`.

### 7.3 Type-specific forms

`NewTicket.tsx` shows a type selector; selecting a type renders the appropriate form:

- **incident** ‒ reuse the existing incident form fields (CIA impact, detection/knowledge time, reporter, severity) from `Incidents.tsx`, posting to `/tickets` with `type='incident'`.
- **service_request** ‒ catalog item picker (from `/service-catalog`), requester, description.
- **problem** ‒ related incidents picker, root cause, workaround.
- **change** ‒ change type (standard/normal/emergency), risk level, implementation/rollback plans, CAB approval flag.

### 7.4 Status transition UI

`TicketDetail.tsx` renders allowed next-status buttons from the `transitions` array in the detail response (driven by the shared `ticketTransitions` matrix). Reuse the `incidentStatusHelpers.ts` pattern ([`incidentStatusHelpers.ts`](Asset-Management/frontend/src/pages/incidentStatusHelpers.ts)) generalized to `ticketStatusHelpers.ts`. Gated actions (close, escalate, approve) call the dedicated endpoints.

### 7.5 Role-gated UI

Use `useAuthStore` + a small `usePermission` hook (or the existing role check pattern) to show/hide:

- **Create/Update/Assign/Comment/Transition** ‒ `tickets.write`.
- **Close / Escalate** ‒ `tickets.close` / `tickets.escalate`.
- **CAB Approve** (change type) ‒ `tickets.approve`.
- **Catalog / SLA management** (Admin) ‒ `serviceCatalog.manage`.
- **Ticket Viewer / Auditor** ‒ read-only: no mutating buttons rendered.

### 7.6 API client

Add `ticketApi` to [`frontend/src/services/api.ts`](Asset-Management/frontend/src/services/api.ts) with concrete DTO types imported from `shared` (mirroring `incidentApi`). Add `ticketApi` unit tests in `api.test.ts`.

---

## 8. Phased Implementation Steps

> Backend before frontend. Each phase is independently verifiable (typecheck + targeted tests) before the next.

### Phase 0 ‒ Shared package
1. Add `shared/src/types/ticket.ts` (`TicketType`, `TicketStatus` per type, `TicketPriority`, `TicketUrgency`, `TicketImpact`, `Ticket`, extension interfaces, `TicketHistoryAction`).
2. Add `shared/src/ticketTransitions.ts` (per-type matrices; `incident` reuses `INCIDENT_TRANSITIONS`) + `computePriority()`.
3. Add `shared/src/dtos/ticket.ts` (Zod `CreateTicketSchema`, `UpdateTicketSchema`, `ChangeTicketStatusSchema`, extension schemas).
4. Export from `shared/src/index.ts`.
5. **Verify:** `cd shared && npm run build`; `tsc --noEmit`.

### Phase 1 ‒ Prisma schema & migration
1. Add the new models from Section 2 to [`backend/prisma/schema.prisma`](Asset-Management/backend/prisma/schema.prisma) (`Ticket`, `TicketAsset`, `TicketComment`, `TicketLink`, `TicketHistoryEntry`, `TicketTypeConfig`, `ServiceCatalogItem`, `Problem`, `Change`, `ServiceRequest`) + `Asset.ticketLinks`, `ServiceCatalogItem.serviceRequests`.
2. Add nullable unique `ticketId` to the existing `Incident` model + `ticket Ticket?` relation.
3. Create migration `2026MMDDHHMMSS_it_ticket_system` (additive; backfill per Section 2.5).
4. **Verify:** `npx prisma validate`, `npx prisma generate`, `npx prisma migrate dev`.

### Phase 2 ‒ Data migration (incident backfill)
1. Implement the idempotent backfill (Section 2.5) as a migration step or `scripts/` runner: create `tickets` rows for existing incidents, set `incidents.ticketId`, seed `ticket_type_configs` + starter catalog, backfill `DisplayIdCounter['ticket:incident']`.
2. **Verify:** row-count parity (`incidents` = `tickets` where `type='incident'`), no orphaned `ticketId`, display-ID sequence continuity.

### Phase 3 ‒ RBAC
1. Add new permission strings to `GRANULAR_PERMISSIONS` ([`authorization.service.ts:5`](Asset-Management/backend/src/services/authorization.service.ts:5)).
2. Add `'tickets'` to `EntityType`, `READ/WRITE_PERMISSION_BY_RESOURCE`, and the `tickets` branches of `resolveEntityScope`/`buildScopedFilter`.
3. Seed new roles (`ticket_viewer`, `service_desk_agent`, `it_manager`, `service_catalog_manager`) + add `tickets.read` to `auditor` in [`backend/prisma/seed.ts`](Asset-Management/backend/prisma/seed.ts).
4. **Verify:** `npx jest` for authorization tests; new scenarios in Section 9.

### Phase 4 ‒ Ticket service & routes (backend)
1. Implement [`backend/src/services/ticket.service.ts`](Asset-Management/backend/src/services/ticket.service.ts): CRUD, display-ID via `DisplayIdCounter`, SLA computation, type-extension creation, transition validation via `validateTransition('tickets', type, from, to)`, audit logging (`AuditService`, `entityType='ticket'`) + `TicketHistoryEntry` writes, asset junction sync, cross-links.
2. Register `tickets` in `transitionMatrix` ([`statusTransition.ts:168`](Asset-Management/backend/src/services/statusTransition.ts:168)) keyed by type.
3. Implement [`backend/src/routes/ticket.routes.ts`](Asset-Management/backend/src/routes/ticket.routes.ts) (Section 6.1) + `ticket-types` + `service-catalog` routes.
4. Mount in [`backend/src/index.ts`](Asset-Management/backend/src/index.ts).
5. **Verify:** `npx tsc --noEmit`; `npx jest` ticket service + route tests.

### Phase 5 ‒ Incident backward-compat layer
1. Update `incident.service.ts` to read/write through the `ticket`+`incident` pair while preserving the public `/incidents` contract and `incidents.*` permissions.
2. **Verify:** existing `incident.history.test.ts` + incident route tests still pass unchanged.

### Phase 6 ‒ Frontend
1. Add `ticketApi` + DTO imports to [`frontend/src/services/api.ts`](Asset-Management/frontend/src/services/api.ts).
2. Build `Tickets.tsx`, `NewTicket.tsx` (type-specific forms), `TicketDetail.tsx` (transitions, comments, links, history, role-gated actions).
3. Add `ticketStatusHelpers.ts`; register routes in `App.tsx`; add nav item + i18n keys in `Layout.tsx`/locales.
4. **Verify:** `npm run build`; component tests.

### Phase 7 ‒ Testing
Per Section 9.

### Phase 8 ‒ Compliance documentation
Per Section 10.

---

## 9. Testing Plan

### 9.1 Shared unit tests
- `shared/src/ticketTransitions.test.ts` ‒ per-type matrix correctness, terminal states, `incident` matrix parity with `INCIDENT_TRANSITIONS`, `getAllowedTicketTransitions` edge cases.
- `computePriority` truth-table test.

### 9.2 Backend unit tests (Jest + `prisma-mock`)
- `src/__tests__/ticket.service.test.ts` ‒ create (display ID, SLA, extension row), transition allowed/denied (via `TransitionReason` codes), close gating, escalate, comment internal/external, asset junction sync, cross-link uniqueness, audit + history entry written.
- `src/__tests__/ticket.statusTransition.test.ts` ‒ `validateTransition('tickets', type, from, to)` for each type incl. illegal transitions.
- Authorization: extend `authorization.integration.test.ts` scenarios for `tickets` (none/readonly/readwrite, scoped vs unscoped, `tickets.close`/`escalate`/`approve` gating, `serviceCatalog.manage`).

### 9.3 Backend integration tests
- `src/__tests__/ticket.routes.test.ts` ‒ full HTTP flow per endpoint with auth + permission matrix (401/403/200/404/409).
- `src/__tests__/incident.compat.test.ts` ‒ `/incidents` still returns identical payload shape; creating an incident via `/incidents` creates a linked `tickets` row (`type='incident'`); NIS2 endpoints unaffected.

### 9.4 Frontend tests
- Vitest/RTL: `Tickets.test.tsx` (list, filters, role-gated buttons), `NewTicket.test.tsx` (type selector swaps forms), `TicketDetail.test.tsx` (transition buttons from `transitions`, close/escalate gating, comment internal flag).
- `api.test.ts` ‒ `ticketApi` request/response mapping.

### 9.5 E2E (Playwright)
- `frontend/e2e/ticket-workflows.spec.ts`:
  1. Service Desk Agent creates a `service_request` from catalog, transitions to `fulfilled`, adds an internal comment.
  2. IT Manager creates a `change`, approves via CAB, transitions to `closed`.
  3. Ticket Viewer sees the list but has **no** mutating buttons (role-gating assertion).
  4. Incident created via the existing `/incidents` flow appears under `/tickets` with `type='incident'` (back-compat).

### 9.6 Gate
Full backend suite + `npx prisma validate` + frontend build + Playwright must pass before merge (mirrors the repo's existing verification steps).

---

## 10. Compliance Documentation Updates

| File | Change |
|------|--------|
| `docs/compliance-matrix.yml` | Add `TCKT-*` entries (see below) under the existing status vocabulary; cross-reference `INC-001` for the incident type's NIS2 coverage. |
| `docs/compliance-matrix.md` | Mirror the new `TCKT-*` entries (the `.md` embeds the YAML for reference). |
| `docs/requirements.md` | Add a new phase section **"IT Ticket System"** with `TCKT-*` requirements (ID, priority, category `TCK`, description, acceptance criteria), following the existing table format. |
| `docs/security-model.md` | Add `tickets` to the RBAC role table (Section 3.1) and the entity-level authorization section (Section 3.2); list the new roles and the `tickets` entity scoping path (`ticketAssets -> asset`). |

**New `TCKT-*` matrix entries (proposed):**

| ID | Title | Priority | Status (target) |
|----|-------|----------|-----------------|
| TCKT-001 | Generic ticket entity with `type` field (incident/service_request/problem/change) | P1 | implemented |
| TCKT-002 | Per-type ITIL state machines (shared single source of truth) | P1 | implemented |
| TCKT-003 | Priority/urgency/impact + SLA target & breach tracking | P1 | implemented |
| TCKT-004 | Ticket type config + service catalog (request fulfillment) | P2 | implemented |
| TCKT-005 | Ticket audit trail (Phase 9 hash chain + per-ticket history) | P0 | implemented |
| TCKT-006 | Ticket RBAC (5 roles, granular `tickets.*`/`serviceCatalog.*` permissions, scoped) | P0 | implemented |
| TCKT-007 | Incident backward compatibility (`/incidents` as filtered view) | P1 | implemented |
| TCKT-008 | Cross-ticket linkage (incident ⇄ problem ⇄ change) | P2 | implemented |

---

## 11. Key Decisions Summary

1. **Data model:** New `tickets` base table + 1:1 type-specific extension tables; `incidents` kept as the `incident` extension (Option b). No rename, no column drops.
2. **Ticket types:** `incident`, `service_request`, `problem`, `change` (ITIL 4).
3. **State machines:** New shared `ticketTransitions.ts`; `incident` reuses the existing matrix verbatim.
4. **Roles:** `ticket_viewer`, `service_desk_agent`, `it_manager`, `service_catalog_manager` (+ `auditor` gains `tickets.read`), mapped onto the existing `Permission`/`RolePermission`/`UserRole`/`GroupRole` RBAC.
5. **Permissions:** `tickets.read/write/close/escalate/approve/manage`, `serviceCatalog.read/manage`.
6. **Endpoints:** `/tickets` CRUD + `status`/`assign`/`comments`/`close`/`escalate`/`links`/`history`; `/ticket-types`; `/service-catalog`. `/incidents` retained as a filtered view.
7. **Phases:** 0 shared types/DTOs/transitions ‒ 1 schema+migration ‒ 2 incident backfill ‒ 3 RBAC ‒ 4 ticket service+routes ‒ 5 incident back-compat ‒ 6 frontend ‒ 7 testing ‒ 8 compliance docs.
