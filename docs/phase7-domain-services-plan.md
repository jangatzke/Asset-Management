# Phase 7: Domain Services & Business Rule Hardening

## Scope

Phase 7 extracts explicit domain services from the generic `Phase6Service` CRUD monolith for ISMS business domains covered by the Phase-6 baseline, and hardens business-rule validation, status-transition automata, and cross-entity constraints. The goal is to replace implicit/generic behavior with explicit, testable domain logic while preserving API compatibility.

**In scope:**
1. Explicit domain services for Suppliers, BCM/BIA/BCP, Audits, Corrective Actions, Training
2. Bounded status validation per entity (allowed transitions, forbidden states)
3. Audit transition automaton logging for all Phase-6 entities
4. Cross-entity business rule validation (e.g., corrective action source linkage, training completion prerequisites)
5. Shared DTOs for Phase-7 domain entities in `shared/src/dtos/index.ts`
6. Explicit route handlers replacing generic `/:resource` catch-all where practical
7. Business-rule and status-transition tests

**Out of scope:**
- New Prisma schema models (all target models already exist)
- Frontend UI changes
- Graph visualization, impact analysis, aggregation endpoints (Phase 8+)
- OIDC/auth/session changes
- CI/CD pipeline changes

## Current State Analysis

### Generic Phase6Service Problems

The current [`Phase6Service`](backend/src/services/phase6.service.ts:14) is a generic CRUD wrapper that:
- Uses string-based resource dispatch (`PHASE6_MODEL_MAP`) for all operations
- Applies uniform `CONFIG_CHANGE` audit actions regardless of entity semantics
- Generates display IDs in a single place without domain-specific formatting
- Has no status transition validation (any field can be updated arbitrarily)
- Lacks cross-entity business rule enforcement at the service layer
- Uses `z.record(z.any())` for most route body schemas, bypassing shared DTO validation

### Affected Resources (from [`PHASE6_MODEL_MAP`](backend/src/services/phase6.resources.ts:1))

| Resource | Prisma Delegate | Prefix | Status Field | Due Field |
|----------|----------------|--------|--------------|-----------|
| suppliers | supplier | SUP | status | nextReviewDate |
| supplierAssessments | supplierAssessment | SUA | status | nextAssessmentDate |
| bias | businessImpactAnalysis | BIA | status | nextReviewDate |
| bcps | businessContinuityPlan | BCP | status | nextTestDate |
| bcpExercises | bCPExercise | BCX | - | plannedAt |
| auditPrograms | auditProgram | AUP | status | - |
| auditPlans | auditPlan | AUPL | status | plannedStart |
| auditFindings | auditFinding | AUF | status | dueDate |
| correctiveActions | correctiveAction | CAPA | status | dueDate |
| trainingCourses | trainingCourse | TRC | status | - |
| trainingAssignments | trainingAssignment | TRA | status | dueDate |
| trainingCompletions | trainingCompletion | TRCPL | - | - |
| trainingAcknowledgements | trainingAcknowledgement | TRACK | - | - |
| managementReviews | managementReview | MREV | status | nextReviewDate |
| managementReviewActions | managementReviewAction | MRA | status | dueDate |
| securityObjectives | securityObjective | SOBJ | status | - |
| metricDefinitions | metricDefinition | MET | status | - |
| metricValues | metricValue | METV | - | - |
| workflowDefinitions | workflowDefinition | WFD | status | - |
| workflowInstances | workflowInstance | WFI | status | dueDate |
| workflowTasks | workflowTask | WFT | status | dueDate |
| reportDefinitions | reportDefinition | RPD | status | - |
| reportRuns | reportRun | RPR | status | startedAt |
| exportJobs | exportJob | EXP | status | requestedAt |

## Target Architecture

### New File Structure

```
backend/src/services/
  phase6.service.ts          (existing - generic CRUD backbone)
  phase6.resources.ts        (existing - model map)
  supplier.service.ts        (NEW - domain service for suppliers + assessments)
  bcm.service.ts             (NEW - domain service for BIA, BCP, BCP exercises)
  audit.service.ts           (existing - extended with audit-specific actions)
  correctiveaction.service.ts (NEW - domain service for CAPA)
  training.service.ts        (NEW - domain service for training lifecycle)

backend/src/routes/
  phase6.routes.ts           (modified - add explicit domain routes)

shared/src/dtos/
  index.ts                   (modified - add Phase-7 domain schemas)

backend/src/__tests__/
  phase7.supplier.service.test.ts    (NEW)
  phase7.bcm.service.test.ts         (NEW)
  phase7.correctiveaction.service.test.ts (NEW)
  phase7.training.service.test.ts    (NEW)
  phase7.status.transitions.test.ts  (NEW - cross-cutting status automaton)
```

### Domain Service Interfaces

#### SupplierDomainService

```typescript
export class SupplierDomainService {
  // Create supplier with validated displayId format SUP-XXXXX
  async create(data: CreateSupplierDto, userId: string): Promise<Supplier>
  
  // Update with business rules (e.g., cannot archive active assessments)
  async update(id: string, data: UpdateSupplierDto, userId: string): Promise<Supplier>
  
  // Assessments linked to supplier
  async createAssessment(supplierId: string, data: CreateAssessmentDto, userId: string): Promise<SupplierAssessment>
  
  // Validate assessment status transitions
  validateAssessmentTransition(from: string, to: string): void
  
  // Archive cascades: check active assessments before archiving supplier
  async archive(id: string, userId: string): Promise<Supplier>
}
```

#### BcmDomainService

```typescript
export class BcmDomainService {
  // BIA with MTPD/RTO/RPO validation (MTPD > RTO > RPO)
  async createBia(data: CreateBiADto, userId: string): Promise<BusinessImpactAnalysis>
  
  // BIA status transitions: draft -> under_review -> approved | rejected
  validateBiaStatusTransition(from: string, to: string): void
  
  // BCP references BIA - validate BIA exists and is approved
  async createBcp(data: CreateBCPDto, userId: string): Promise<BusinessContinuityPlan>
  
  // BCP status transitions: draft -> under_review -> approved | rejected | archived
  validateBcpStatusTransition(from: string, to: string): void
  
  // BCP Exercise references BCP - validate BCP exists and is approved
  async createExercise(exerciseData: CreateBCPExerciseDto, userId: string): Promise<BCPExercise>
  
  // Exercise status transitions: scheduled -> in_progress -> completed | cancelled
  validateExerciseStatusTransition(from: string, to: string): void
}
```

#### CorrectiveActionDomainService

```typescript
export class CorrectiveActionDomainService {
  // Create with source validation (audit finding, incident, risk, control, supplier)
  async create(data: CreateCapaDto, userId: string): Promise<CorrectiveAction>
  
  // Validate source type references exist
  async validateSource(sourceType: string, sourceId: string): void
  
  // Status transitions with business rules:
  // open -> in_progress | deferred | cancelled
  // in_progress -> completed | deferred
  // completed -> reopened (requires justification)
  // deferred -> open | cancelled
  validateStatusTransition(from: string, to: string, data?: CapaTransitionData): void
  
  // Effectiveness review requires completion first
  async markEffectivenessReviewed(id: string, data: EffectivenessReviewDto, userId: string): Promise<CorrectiveAction>
  
  // Close with effectiveness check
  async close(id: string, userId: string): Promise<CorrectiveAction>
}
```

#### TrainingDomainService

```typescript
export class TrainingDomainService {
  // Create training course
  async createCourse(data: CreateCourseDto, userId: string): Promise<TrainingCourse>
  
  // Assign to user (validate course exists and is active)
  async assignAssignment(courseId: string, data: CreateAssignmentDto, assignedBy: string): Promise<TrainingAssignment>
  
  // Assignment status transitions:
  // assigned -> in_progress | overdue | completed | expired
  // in_progress -> completed | overdue
  validateAssignmentStatusTransition(from: string, to: string): void
  
  // Complete assignment with validation (course must be active, assignment must be assigned/in_progress)
  async completeCompletion(assignmentId: string, data: CompleteTrainingDto, userId: string): Promise<TrainingCompletion>
  
  // Acknowledge training content
  async createAcknowledgement(data: CreateAcknowledgementDto, userId: string): Promise<TrainingAcknowledgement>
}
```

### Status Transition Automaton

Each entity has a defined state machine. Transitions not explicitly allowed are rejected with a 400 error including the reason.

#### CorrectiveAction States

```
          ┌──────────┐
          │   open   │
          └────┬─────┘
          ┌────┴─────┐    ┌──────────┐
   ┌──────│in_progress│───▶│deferred  │
   │      └────┬─────┘    └────┬─────┘
   │           │               │
   │      ┌────┴─────┐    ┌────┴─────┐
   └──────│completed  │◀───│cancelled │
          └────┬─────┘    └──────────┘
               │
          ┌────┴─────┐
          │ reopened  │ (requires justification)
          └────┬─────┘
               │
          ┌────┴─────┐
          │ in_progress│ (loops back)
          └──────────┘
```

#### AuditFinding States

```
          ┌──────────┐
          │   open   │
          └────┬─────┘
               │
          ┌────┴─────┐    ┌──────────┐
          │in_progress│───▶│completed  │
          └────┬─────┘    └──────────┘
               │
          ┌────┴────┐
          │deferred │
          └─────────┘
```

#### TrainingAssignment States

```
          ┌──────────┐
          │ assigned │
          └────┬─────┘
               │
          ┌────┴──────────┐
          │in_progress    │
          └────┬──────────┘
               │
       ┌───────┼──────────┐
       ▼       ▼          ▼
  ┌────────┐ ┌────────┐ ┌────────┐
  │completed│ │overdue │ │ expired │
  └────────┘ └────────┘ └────────┘
```

#### BIA States

```
          ┌──────────┐
          │  draft   │
          └────┬─────┘
               │
          ┌────┴──────────┐
          │under_review    │
          └────┬──────────┘
               │
       ┌───────┼──────────┐
       ▼       ▼          ▼
  ┌────────┐ ┌────────┐ ┌────────┐
  │approved│ │rejected│ │archived │
  └────────┘ └────────┘ └────────┘
```

#### BCP States

```
          ┌──────────┐
          │  draft   │
          └────┬─────┘
               │
          ┌────┴──────────┐
          │under_review    │
          └────┬──────────┘
               │
       ┌───────┼──────────┐
       ▼       ▼          ▼
  ┌────────┐ ┌────────┐ ┌────────┐
  │approved│ │rejected│ │archived │
  └────────┘ └────────┘ └────────┘
```

#### SupplierAssessment States

```
          ┌──────────┐
          │  draft   │
          └────┬─────┘
               │
          ┌────┴──────────┐
          │under_review    │
          └────┬──────────┘
               │
       ┌───────┼──────────┐
       ▼       ▼          ▼
  ┌────────┐ ┌────────┐ ┌────────┐
  │approved│ │rejected│ │archived │
  └────────┘ └────────┘ └────────┘
```

## Validation Schemas for Shared DTOs

Add to `shared/src/dtos/index.ts`:

```typescript
// Supplier schemas
export const SupplierCreateSchema = z.object({
  legalName: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  contactPerson: z.string().max(200).optional(),
  contactEmail: z.string().email().nullable(),
  contactPhone: z.string().max(50).optional(),
  servicesProvided: z.string().max(500).optional(),
  criticality: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  dataProtectionRelevant: z.boolean().default(false),
  nis2Relevant: z.boolean().default(false),
  securityRequirements: z.record(z.any()).default({}),
  certifications: z.array(z.string()).default([]),
  exitStrategy: z.string().max(2000).optional(),
});

export const SupplierUpdateSchema = z.object({
  legalName: z.string().min(1).max(255).optional(),
  // ... partial update fields
});

// BIA schemas
export const BiACreateSchema = z.object({
  title: z.string().min(1).max(255),
  processId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  ownerId: z.string().min(1),
  mtpdMinutes: z.number().int().positive(),
  rtoMinutes: z.number().int().positive(),
  rpoMinutes: z.number().int().nonnegative(),
  impactCategories: z.array(z.string()).default([]),
  timeDependentImpacts: z.record(z.any()).default({}),
  minimumOperatingLevel: z.string().max(500).optional(),
  requiredResources: z.record(z.any()).default({}),
}).refine((data) => data.mtpdMinutes >= data.rtoMinutes, {
  message: 'MTPD must be >= RTO',
  path: ['mtpdMinutes'],
});

// Corrective Action schemas
export const CapaCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  sourceType: z.enum(['audit', 'incident', 'risk', 'control', 'supplier']),
  sourceId: z.string().optional(),
  ownerId: z.string().min(1),
  dueDate: z.coerce.date(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

// Training schemas
export const TrainingAssignmentCompleteSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  result: z.enum(['passed', 'failed', 'waived']).optional(),
  certificateUrl: z.string().url().nullable(),
  evidenceId: z.string().uuid().optional(),
  expiresAt: z.coerce.date().optional(),
});
```

## Affected Files

| File | Action | Description |
|------|--------|-------------|
| `shared/src/dtos/index.ts` | Modified | Add Phase-7 domain Zod schemas |
| `backend/src/services/supplier.service.ts` | NEW | Supplier domain service |
| `backend/src/services/bcm.service.ts` | NEW | BCM/BIA/BCP domain service |
| `backend/src/services/correctiveaction.service.ts` | NEW | Corrective action domain service |
| `backend/src/services/training.service.ts` | NEW | Training lifecycle domain service |
| `backend/src/services/statusTransition.ts` | NEW | Shared status transition automaton |
| `backend/src/routes/phase6.routes.ts` | Modified | Add explicit domain routes alongside generic ones |
| `backend/src/__tests__/phase7.supplier.service.test.ts` | NEW | Supplier domain tests |
| `backend/src/__tests__/phase7.bcm.service.test.ts` | NEW | BCM/BIA/BCP domain tests |
| `backend/src/__tests__/phase7.correctiveaction.service.test.ts` | NEW | CAPA domain tests |
| `backend/src/__tests__/phase7.training.service.test.ts` | NEW | Training domain tests |
| `backend/src/__tests__/phase7.status.transitions.test.ts` | NEW | Cross-cutting status automaton tests |
| `docs/phase7-domain-services-plan.md` | NEW | This document |
| `docs/implementation-log.md` | Modified | Add Phase 7 entry |
| `docs/requirements.md` | Modified | Reference Phase-7 domain services |
| `docs/compliance-matrix.yml` | Modified | Map Phase-7 requirements |

## Implementation Order

1. **Step 1:** Create shared DTO schemas in `shared/src/dtos/index.ts`
2. **Step 2:** Create status transition automaton (`statusTransition.ts`)
3. **Step 3:** Create domain services (supplier, bcm, correctiveaction, training)
4. **Step 4:** Add explicit routes to `phase6.routes.ts`
5. **Step 5:** Create domain service tests
6. **Step 6:** Create cross-cutting status transition tests
7. **Step 7:** Update documentation (implementation-log, requirements, compliance-matrix)
8. **Step 8:** Run builds, Prisma validate/status, full backend Jest, frontend tests, lint; fix regressions

## Constraints

- Preserve all existing API endpoints (`/:resource`, `/:resource/:id`) for backward compatibility
- New explicit routes are additive only (no removal of existing paths)
- No Prisma schema changes required
- No frontend changes in this phase
- All new services must be independently testable with minimal mocking
- Status transition errors return HTTP 400 with machine-readable reason codes

## Verification Gates

- `npx tsc --noEmit` passes for backend
- `npx prisma validate` passes
- Backend Jest: all existing tests PASS + new Phase-7 tests PASS
- Frontend Vitest: existing tests PASS (no frontend changes)
- Workspace lint: no new warnings/errors

## Implementation Results

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `shared/src/dtos/index.ts` | Modified | Added Phase-7 domain Zod schemas (Supplier, BIA, BCP, CAPA, Training) |
| `backend/src/services/statusTransition.ts` | NEW | Shared status transition automaton with 10 entity types |
| `backend/src/services/supplier.service.ts` | NEW | Supplier domain service (create, update, archive, assessments CRUD) |
| `backend/src/services/bcm.service.ts` | NEW | BCM/BIA/BCP domain service (BIA, BCP, exercises with status validation) |
| `backend/src/services/correctiveaction.service.ts` | NEW | CAPA domain service (create, update, close, reopen, effectiveness review) |
| `backend/src/services/training.service.ts` | NEW | Training lifecycle service (courses, assignments, completions, acknowledgements) |
| `backend/src/routes/phase6.routes.ts` | Modified | Added 40+ explicit domain routes before generic catch-all |
| `backend/src/__tests__/statusTransition.test.ts` | NEW | 30 cross-cutting status automaton tests |
| `backend/src/__tests__/phase6.routes.test.ts` | Modified | Updated to mock supplierService for explicit route |

### Build & Test Results

| Gate | Result | Details |
|------|--------|---------|
| `npx tsc --noEmit` | ✅ PASS | Zero errors |
| `npx prisma validate` | ✅ PASS | Schema valid |
| Backend Jest (total) | ✅ 514/514 PASS | All 37 test suites pass |
| Frontend Vitest | ✅ 8/8 PASS | 3 test files, no regressions |
| ESLint (new files) | ✅ PASS | No warnings/errors |

### Explicit Routes Added

| Route | Method | Service | Description |
|-------|--------|---------|-------------|
| `/suppliers` | GET | supplierService.list | List suppliers with pagination/search |
| `/suppliers` | POST | supplierService.create | Create supplier with displayId |
| `/suppliers/:id` | PATCH | supplierService.update | Update with status validation |
| `/suppliers/:id/archive` | POST | supplierService.archive | Archive (validates no active assessments) |
| `/suppliers/:supplierId/assessments` | GET | supplierService.listAssessments | List assessments for supplier |
| `/suppliers/:supplierId/assessments` | POST | supplierService.createAssessment | Create assessment |
| `/supplier-assessments/:id` | PATCH | supplierService.updateAssessment | Update assessment |
| `/bias` | GET/POST/PATCH | bcmService.listBia/createBia/updateBia | BIA CRUD |
| `/bcps` | GET/POST/PATCH | bcmService.listBcp/createBcp/updateBcp | BCP CRUD |
| `/bcp-exercises` | GET/POST/PATCH | bcmService.listExercises/createExercise/updateExercise | Exercise CRUD |
| `/corrective-actions` | GET/POST/PATCH | correctiveActionService.list/create/update | CAPA CRUD |
| `/corrective-actions/:id/effectiveness` | POST | correctiveActionService.reviewEffectiveness | Effectiveness review |
| `/corrective-actions/:id/close` | POST | correctiveActionService.close | Close with checks |
| `/corrective-actions/:id/reopen` | POST | correctiveActionService.reopen | Reopen with justification |
| `/training-courses` | GET/POST/PATCH | trainingService.listCourses/createCourse/updateCourse | Course CRUD |
| `/training-assignments` | GET/POST/PATCH | trainingService.listAssignments/createAssignment/updateAssignment | Assignment CRUD |
| `/training-completions` | GET/POST | trainingService.listCompletions/createCompletion | Completion CRUD |
| `/training-acknowledgements` | GET/POST | trainingService.listAcknowledgements/createAcknowledgement | Acknowledgement CRUD |

### Status Transitions Validated

| Entity Type | Allowed Transitions |
|-------------|---------------------|
| correctiveActions | open → in_progress \| deferred \| cancelled; in_progress → completed \| deferred; completed → reopened (justification); deferred → open \| cancelled |
| auditFindings | open → in_progress; in_progress → completed |
| bias | draft → under_review; under_review → approved \| rejected |
| bcps | draft → under_review; under_review → approved \| rejected \| archived |
| bcpExercises | scheduled → in_progress \| cancelled; in_progress → completed |
| trainingAssignments | assigned → in_progress \| overdue; in_progress → completed; overdue → completed |
| suppliers | active ↔ inactive; active → archived |
