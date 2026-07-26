# RiskControl workflow vertical implementation plan

## Purpose and scope

Plan a complete vertical implementation of the Risk to RiskControl to ControlImplementation relationship workflow while keeping TreatmentAction to ControlImplementation fachlich separated. This plan is based on repository inspection only; no source implementation changes are included in this plan.

## Current-state findings

### Schema and persistence

- The canonical RiskControl model already exists as [`RiskControl`](backend/prisma/schema.prisma:780), linked from [`Risk`](backend/prisma/schema.prisma:688) through [`riskControls`](backend/prisma/schema.prisma:724) and from [`ControlImplementation`](backend/prisma/schema.prisma:1297) through [`riskControls`](backend/prisma/schema.prisma:1324).
- [`RiskControl`](backend/prisma/schema.prisma:780) has the required canonical attributes: [`riskId`](backend/prisma/schema.prisma:782), [`controlImplementationId`](backend/prisma/schema.prisma:783), [`role`](backend/prisma/schema.prisma:784), [`mitigationDimension`](backend/prisma/schema.prisma:785), [`isKeyControl`](backend/prisma/schema.prisma:786), and a uniqueness constraint on the pair at [`@@unique([riskId, controlImplementationId])`](backend/prisma/schema.prisma:795).
- [`RiskControlAssessment`](backend/prisma/schema.prisma:801) exists and is version-bound via [`riskAssessmentVersionId`](backend/prisma/schema.prisma:804), with unique assessment per RiskControl and RiskAssessmentVersion at [`@@unique([riskControlId, riskAssessmentVersionId])`](backend/prisma/schema.prisma:820).
- Direct obsolete array fields have mostly been removed from schema comments and models: [`Risk`](backend/prisma/schema.prisma:694) comments state affected arrays were removed, and [`Control`](backend/prisma/schema.prisma:1268) states direct risk-control links were removed.
- Legacy many-to-many relation fields still exist for Asset-to-Risk and Asset-to-Control as [`risks`](backend/prisma/schema.prisma:430) and [`controls`](backend/prisma/schema.prisma:431), but those are asset/control relations, not the obsolete direct Risk-Control array targeted by this workflow.
- [`TreatmentAction`](backend/prisma/schema.prisma:894) separately links to [`ControlImplementation`](backend/prisma/schema.prisma:911) via [`controlImplementationId`](backend/prisma/schema.prisma:897). This is correctly separate from [`RiskControl`](backend/prisma/schema.prisma:780), but the UI currently blurs workflow semantics by using ControlImplementation selection inside the treatment modal.
- [`EvidenceLink`](backend/prisma/schema.prisma:1717) supports generic evidence association and optional typed relations to [`RiskControlAssessment`](backend/prisma/schema.prisma:1727) and [`ControlTest`](backend/prisma/schema.prisma:1729).

### Backend routes and services

- [`riskRouter`](backend/src/routes/risk.routes.ts:10) currently exposes flat, non-canonical endpoints: POST risk-control link at [`/risk-controls`](backend/src/routes/risk.routes.ts:59) and POST risk-control assessment at [`/risk-control-assessments`](backend/src/routes/risk.routes.ts:68).
- Required nested REST endpoints under the risk resource do not exist: list/create/delete/update under `/api/v1/risks/:riskId/controls`, and list/detail/create under `/api/v1/risks/:riskId/controls/:riskControlId/assessments` are missing from [`risk.routes.ts`](backend/src/routes/risk.routes.ts:1).
- Required ControlImplementation to Risks endpoint is missing from [`control.routes.ts`](backend/src/routes/control.routes.ts:1). There is no route such as `/api/v1/controls/implementations/:implementationId/risks`.
- [`RiskService.getById()`](backend/src/services/risk.service.ts:205) does not include [`riskControls`](backend/src/services/risk.service.ts:205). It attempts to include [`evidenceLinks`](backend/src/services/risk.service.ts:223), but [`Risk`](backend/prisma/schema.prisma:688) does not define an [`evidenceLinks`](backend/prisma/schema.prisma:1717) relation, which is a schema/service mismatch.
- [`RiskService.getAssessments()`](backend/src/services/risk.service.ts:766) includes RiskControlAssessment rows with the full [`riskControl`](backend/src/services/risk.service.ts:771) to [`controlImplementation`](backend/src/services/risk.service.ts:771) to [`control`](backend/src/services/risk.service.ts:771) chain.
- [`RiskService.getCurrentAssessment()`](backend/src/services/risk.service.ts:781) includes control assessments, but only includes shallow [`riskControl`](backend/src/services/risk.service.ts:790), not [`controlImplementation`](backend/src/services/risk.service.ts:790) and [`control`](backend/src/services/risk.service.ts:790).
- [`RiskService.linkRiskControl()`](backend/src/services/risk.service.ts:795) validates [`role`](backend/src/services/risk.service.ts:796), [`mitigationDimension`](backend/src/services/risk.service.ts:797), risk existence, and ControlImplementation existence, and returns [`controlImplementation`](backend/src/services/risk.service.ts:815) with [`control`](backend/src/services/risk.service.ts:815). Missing: nested riskId enforcement from route params, audit logging, duplicate conflict handling clarity, update/delete/list helpers, and DTO route validation.
- [`RiskService.assessRiskControl()`](backend/src/services/risk.service.ts:819) validates mandatory justification at [`line 820`](backend/src/services/risk.service.ts:820), validates assessment mutability at [`line 826`](backend/src/services/risk.service.ts:826), checks same-risk ownership at [`line 827`](backend/src/services/risk.service.ts:827), creates evidence links at [`line 843`](backend/src/services/risk.service.ts:843), and returns assessment with evidence and shallow riskControl at [`line 855`](backend/src/services/risk.service.ts:855). Missing: list/detail/update semantics, status/effectiveness enum validation, audit logging, richer include graph, and conflict behavior for the unique constraint.
- [`RiskService.rejectDeprecatedRiskControlPayload()`](backend/src/services/risk.service.ts:122) rejects obsolete direct Risk-Control payload fields; [`ControlService.rejectDeprecatedPayload()`](backend/src/services/control.service.ts:90) does the same for Control and SoA payloads.
- [`ControlService.list()`](backend/src/services/control.service.ts:96) includes ControlImplementation rows at [`line 130`](backend/src/services/control.service.ts:130), but not RiskControl links back to risks. [`ControlService.getById()`](backend/src/services/control.service.ts:147) includes implementations, findings, and actions at [`line 152`](backend/src/services/control.service.ts:152), but not linked risks.
- [`ControlService.createImplementation()`](backend/src/services/control.service.ts:374) exists and validates ControlImplementation creation, including scope validation at [`line 377`](backend/src/services/control.service.ts:377).
- [`RiskTreatmentService.create()`](backend/src/services/risktreatment.service.ts:201) creates separate TreatmentAction rows at [`line 267`](backend/src/services/risktreatment.service.ts:267) and correctly does not create RiskControl rows. This fachliche separation should be preserved and made explicit in UI copy and tests.
- [`RiskTreatmentService.complete()`](backend/src/services/risktreatment.service.ts:492) creates or references assessment information and creates a review task at [`line 565`](backend/src/services/risktreatment.service.ts:565), then sets the risk to pending assessment at [`line 581`](backend/src/services/risktreatment.service.ts:581). This already avoids mutating closed historical residual risk directly.

### Validation, authorization, audit, and ETag

- Shared Zod DTOs exist for [`CreateRiskControlSchema`](shared/src/dtos/index.ts:327), [`CreateRiskControlAssessmentSchema`](shared/src/dtos/index.ts:337), [`ControlImplementationSchema`](shared/src/dtos/index.ts:297), and [`CreateControlTestSchema`](shared/src/dtos/index.ts:350).
- These DTOs are not wired into [`risk.routes.ts`](backend/src/routes/risk.routes.ts:1) or [`control.routes.ts`](backend/src/routes/control.routes.ts:1); unlike other route files, those two do not use [`validateBody()`](backend/src/middleware/validation.ts:58) for these payloads.
- Authorization middleware exists as [`authorizeEntityWrite()`](backend/src/middleware/entityAuth.ts:55) and can enforce risks or controls scopes. Nested routes will need a consistent authorization decision where link creation affects both a Risk and a ControlImplementation.
- Audit actions for RiskControl create/delete/update and RiskControlAssessment create/update/close are not present in [`AuditAction`](backend/src/services/audit.service.ts:18). Existing risk and control audit entries include [`RISK_ASSESSMENT_CREATE`](backend/src/services/audit.service.ts:45) and [`CONTROL_IMPLEMENTATION_CREATE`](backend/src/services/audit.service.ts:61), but no RiskControl-specific actions.
- Core routes are mounted with [`etag()`](backend/src/index.ts:147) for risks and controls, so new nested endpoints under these routers will receive ETag headers on GET responses automatically. Existing update methods do not enforce If-Match strictly because [`etag()`](backend/src/middleware/etag.ts:91) warns but does not block when missing.

### Frontend and API client

- [`riskApi`](frontend/src/services/api.ts:64) exposes flat methods [`linkRiskControl`](frontend/src/services/api.ts:74) and [`assessRiskControl`](frontend/src/services/api.ts:75), matching the flat backend routes, not the required nested REST shape.
- [`controlApi`](frontend/src/services/api.ts:79) can list controls, get controls, create implementations, and create tests, but has no method to list risks for a ControlImplementation.
- [`Risks`](frontend/src/pages/Risks.tsx:95) preloads details for the first 20 risks at [`loadRisks()`](frontend/src/pages/Risks.tsx:116), then displays [`riskControls`](frontend/src/pages/Risks.tsx:172) in the table. Because [`RiskService.getById()`](backend/src/services/risk.service.ts:205) does not include riskControls, this UI is likely empty unless list payloads already contain riskControls.
- [`Risks.controlVerificationLabel()`](frontend/src/pages/Risks.tsx:174) uses ControlImplementation status to label controls as effective or tested at [`line 176`](frontend/src/pages/Risks.tsx:176). This is the incorrect implementationStatus equals effective logic that must be removed. Effectiveness must come from latest [`RiskControlAssessment`](backend/prisma/schema.prisma:801), not from [`ControlImplementation.implementationStatus`](backend/prisma/schema.prisma:1304).
- [`Controls.implementationSummary()`](frontend/src/pages/Controls.tsx:156) similarly treats implementationStatus values [`tested`](frontend/src/pages/Controls.tsx:160) and [`effective`](frontend/src/pages/Controls.tsx:160) as effective/tested. This is acceptable only for control verification display if product meaning is ControlTest-derived; for Risk residual reduction it must not be used as risk-control effectiveness.
- [`Risks`](frontend/src/pages/Risks.tsx:486) has a treatment modal that optionally links a TreatmentAction to ControlImplementation at [`line 524`](frontend/src/pages/Risks.tsx:524). There is no separate RiskControls management workflow for linking mitigations to a Risk or assessing effectiveness.
- There is no dedicated Risk Assessment page/component beyond [`Risks`](frontend/src/pages/Risks.tsx:95); no UI exists to create/list RiskControlAssessment rows, attach evidence, or distinguish latest current assessment versions.
- Translations already include basic risk-control labels in [`en.json`](frontend/src/locales/en.json:398) and [`de.json`](frontend/src/locales/de.json:398), but new workflow copy, validation messages, assessment status labels, and treatment separation copy are missing.

### Tests

- Existing backend unit coverage in [`normalized-risk-control-asset-overhaul.test.ts`](backend/src/__tests__/normalized-risk-control-asset-overhaul.test.ts:21) verifies deprecated payload rejection, valid RiskControl creation, invalid role rejection, RiskControlAssessment evidence links, closed assessment immutability, and treatment separation.
- There are no route-level tests for nested `/api/v1/risks/:riskId/controls` or `/api/v1/controls/implementations/:implementationId/risks` endpoints.
- Existing route-order tests in [`route.order.test.ts`](backend/src/__tests__/route.order.test.ts:1) only cover asset routes, so new static control implementation routes and nested risk routes should add route-order coverage.
- Frontend has no visible component tests for RiskControl workflows.

## Proposed implementation plan

### 1. Backend DTO and validation alignment

- Extend shared DTOs in [`shared/src/dtos/index.ts`](shared/src/dtos/index.ts:327):
  - Add query schemas for listing RiskControls by risk and listing risks by ControlImplementation.
  - Add param schemas for nested riskId, riskControlId, assessmentId, and implementationId.
  - Tighten [`CreateRiskControlAssessmentSchema`](shared/src/dtos/index.ts:337) with allowed effectiveness statuses such as effective, partially_effective, ineffective, not_tested, not_applicable, and rating/reduction ranges.
  - Add DTOs for RiskControl update/delete soft-status and RiskControlAssessment detail/list response typing if shared response types are used.
- Wire [`validateBody()`](backend/src/middleware/validation.ts:58), [`validateParams()`](backend/src/middleware/validation.ts:72), and [`validateQuery()`](backend/src/middleware/validation.ts:65) into [`risk.routes.ts`](backend/src/routes/risk.routes.ts:1) and [`control.routes.ts`](backend/src/routes/control.routes.ts:1).

### 2. Backend RiskControl service operations

- Update [`RiskService.getById()`](backend/src/services/risk.service.ts:205):
  - Remove invalid [`evidenceLinks`](backend/src/services/risk.service.ts:223) include from Risk.
  - Include [`riskControls`](backend/prisma/schema.prisma:724) with [`controlImplementation`](backend/prisma/schema.prisma:792), nested [`control`](backend/prisma/schema.prisma:1320), nested [`assessments`](backend/prisma/schema.prisma:793), nested [`riskAssessmentVersion`](backend/prisma/schema.prisma:817), and nested [`evidenceLinks`](backend/prisma/schema.prisma:818) with Evidence details.
  - Sort assessments by [`assessedAt`](backend/prisma/schema.prisma:811) descending so the frontend can reliably select latest effectiveness.
- Add or extend RiskService methods in [`risk.service.ts`](backend/src/services/risk.service.ts:795):
  - listRiskControls(riskId, query)
  - getRiskControl(riskId, riskControlId)
  - createRiskControl(riskId, payload, userId), delegating from or replacing [`linkRiskControl()`](backend/src/services/risk.service.ts:795)
  - updateRiskControl(riskId, riskControlId, payload, userId) for role, mitigationDimension, isKeyControl, and status
  - deleteRiskControl(riskId, riskControlId, userId), preferably soft status inactive unless hard delete is explicitly wanted
  - listRiskControlAssessments(riskId, riskControlId, query)
  - getRiskControlAssessment(riskId, riskControlId, assessmentId)
  - createRiskControlAssessment(riskId, riskControlId, payload, userId), delegating from or replacing [`assessRiskControl()`](backend/src/services/risk.service.ts:819)
- Handle duplicate RiskControl creation against [`@@unique([riskId, controlImplementationId])`](backend/prisma/schema.prisma:795) as HTTP 409 with a clear message.
- Add audit logs after create/update/delete RiskControl and create RiskControlAssessment using new audit actions in [`AuditAction`](backend/src/services/audit.service.ts:18).
- Preserve historical immutability by keeping [`validateAssessmentMutability()`](backend/src/services/risk.service.ts:129), and require callers to create a new RiskAssessmentVersion before reassessing closed versions.

### 3. REST endpoint shape

- In [`risk.routes.ts`](backend/src/routes/risk.routes.ts:1), add nested routes before the generic [`/:id`](backend/src/routes/risk.routes.ts:244) route:
  - GET `/api/v1/risks/:riskId/controls`
  - POST `/api/v1/risks/:riskId/controls`
  - GET `/api/v1/risks/:riskId/controls/:riskControlId`
  - PATCH `/api/v1/risks/:riskId/controls/:riskControlId`
  - DELETE `/api/v1/risks/:riskId/controls/:riskControlId`
  - GET `/api/v1/risks/:riskId/controls/:riskControlId/assessments`
  - POST `/api/v1/risks/:riskId/controls/:riskControlId/assessments`
  - GET `/api/v1/risks/:riskId/controls/:riskControlId/assessments/:assessmentId`
- Keep existing flat endpoints at [`/risk-controls`](backend/src/routes/risk.routes.ts:59) and [`/risk-control-assessments`](backend/src/routes/risk.routes.ts:68) temporarily as compatibility aliases if required, but update the frontend to use nested endpoints. Mark old endpoints for deprecation in comments or docs.
- In [`control.routes.ts`](backend/src/routes/control.routes.ts:1), add static implementation route before [`/:id`](backend/src/routes/control.routes.ts:94):
  - GET `/api/v1/controls/implementations/:implementationId/risks`
- Implement a control service method in [`control.service.ts`](backend/src/services/control.service.ts:89) to load one ControlImplementation and its RiskControls, each with risk, latest RiskControlAssessment, and assessment version context.

### 4. Frontend API client

- Update [`riskApi`](frontend/src/services/api.ts:64) to add nested methods:
  - listRiskControls(riskId, params)
  - createRiskControl(riskId, data)
  - updateRiskControl(riskId, riskControlId, data)
  - deleteRiskControl(riskId, riskControlId)
  - listRiskControlAssessments(riskId, riskControlId, params)
  - getRiskControlAssessment(riskId, riskControlId, assessmentId)
  - createRiskControlAssessment(riskId, riskControlId, data)
- Keep old [`linkRiskControl`](frontend/src/services/api.ts:74) and [`assessRiskControl`](frontend/src/services/api.ts:75) only as compatibility wrappers or remove them if no callers remain.
- Update [`controlApi`](frontend/src/services/api.ts:79) with getImplementationRisks(implementationId, params).

### 5. Risk UI workflow

- In [`Risks`](frontend/src/pages/Risks.tsx:95), add a distinct Risk Controls workflow separate from the treatment modal:
  - Add action button such as Manage Controls next to treatment in the table at [`line 381`](frontend/src/pages/Risks.tsx:381).
  - Risk Controls modal lists RiskControls from the detail payload or nested GET endpoint.
  - Add link form selecting a ControlImplementation, role, mitigation dimension, key-control flag, and status.
  - Add delete/deactivate action for incorrect links.
  - Display control title, implementation scope/status, RiskControl role, mitigationDimension, latest effectiveness status, latest assessment version, and evidence count.
- Replace [`controlVerificationLabel()`](frontend/src/pages/Risks.tsx:174) so it no longer treats [`ControlImplementation.implementationStatus`](backend/prisma/schema.prisma:1304) as risk-control effectiveness. New logic must read latest [`RiskControlAssessment.effectivenessStatus`](backend/prisma/schema.prisma:805), and show Not assessed when none exists.
- Keep implementation status visible as implementation readiness only, not as effectiveness or residual reduction proof.
- Ensure risk list/detail loading uses updated [`RiskService.getById()`](backend/src/services/risk.service.ts:205) response or calls [`riskApi.listRiskControls`](frontend/src/services/api.ts:64) explicitly after loading risk details.

### 6. Risk Assessment UI workflow

- Add RiskControlAssessment creation inside the Risk Controls modal or a focused assessment section in [`Risks`](frontend/src/pages/Risks.tsx:95):
  - Select current RiskAssessmentVersion from [`RiskAssessment`](frontend/src/pages/Risks.tsx:19) or from [`riskApi.listAssessments`](frontend/src/services/api.ts:72).
  - Capture effectiveness status, rating, likelihood reduction, impact reduction, justification, and evidence links.
  - Disable create against closed/completed assessment versions based on [`isClosed`](backend/prisma/schema.prisma:766) and status.
  - Show validation errors returned from nested endpoint.
- If a separate Risk Assessment page is later introduced, keep this component reusable to avoid duplicating business rules.

### 7. Controls UI workflow

- In [`Controls`](frontend/src/pages/Controls.tsx:88), extend ControlImplementation display to show linked risks per implementation using the new [`controlApi`](frontend/src/services/api.ts:79) method.
- Add a modal or expandable row for a ControlImplementation showing linked risks, role, mitigation dimension, latest RiskControlAssessment, and treatment actions separately.
- Keep [`implementationSummary()`](frontend/src/pages/Controls.tsx:156) focused on implementation readiness; avoid implying risk effectiveness or residual risk reduction from [`implementationStatus`](frontend/src/pages/Controls.tsx:159).

### 8. Treatment separation

- Keep [`RiskTreatmentService.create()`](backend/src/services/risktreatment.service.ts:201) behavior that creates [`TreatmentAction`](backend/prisma/schema.prisma:894) records but does not create [`RiskControl`](backend/prisma/schema.prisma:780) records.
- In [`Risks`](frontend/src/pages/Risks.tsx:486), update treatment modal copy around [`selectControlImplementation`](frontend/src/locales/en.json:406) so it says a TreatmentAction may target a ControlImplementation, but this does not establish mitigative RiskControl effectiveness.
- Add explicit post-treatment path: after treatment action completion, user can create or update RiskControl link separately, then assess its effectiveness in the RiskControlAssessment workflow.

### 9. Tests

- Backend service tests:
  - Extend [`normalized-risk-control-asset-overhaul.test.ts`](backend/src/__tests__/normalized-risk-control-asset-overhaul.test.ts:21) for list/detail/update/delete RiskControl methods, duplicate conflict handling, audit logging, latest assessment includes, and no residual risk reduction from ControlImplementation status alone.
  - Add tests for ControlImplementation to risks service method in a control-focused test file or the existing overhaul test.
- Backend route tests:
  - Add nested risk controls route tests using Express and mocked services.
  - Add route-order tests similar to [`route.order.test.ts`](backend/src/__tests__/route.order.test.ts:1) to ensure static control implementation routes do not get swallowed by [`/:id`](backend/src/routes/control.routes.ts:94) and nested risk controls routes are before generic [`/:id`](backend/src/routes/risk.routes.ts:244).
  - Add validation tests proving DTOs reject invalid roles, mitigation dimensions, missing justification, invalid effectiveness status, and cross-risk assessment version use.
  - Add authorization tests for risk write and controls read/write expectations.
- Frontend tests:
  - Add Vitest tests for latest effectiveness label calculation so implementationStatus equal effective does not show risk effectiveness without RiskControlAssessment.
  - Add tests for Risk Controls modal submission payloads and TreatmentAction separation copy.

### 10. Translations and copy

- Extend [`en.json`](frontend/src/locales/en.json:345) and [`de.json`](frontend/src/locales/de.json:345) for:
  - Risk Controls modal title, empty state, add/edit/delete labels.
  - Role labels for preventive, detective, corrective, recovery, compensating.
  - Mitigation dimension labels for likelihood, impact, both.
  - Effectiveness statuses and Not assessed state.
  - Treatment separation warning/notice.
  - Validation messages for missing justification and closed assessment version.

## Sequencing

1. Wire DTO validation and add missing backend service methods while preserving old flat endpoints.
2. Update Risk detail loading to return riskControls with nested ControlImplementation, Control, assessments, assessment versions, and evidence links.
3. Add nested risk controls and assessments routes, plus ControlImplementation to risks route.
4. Add audit action types and audit log calls for RiskControl and RiskControlAssessment operations.
5. Add backend unit and route tests for the new workflow and route ordering.
6. Update frontend API client to nested endpoints.
7. Implement Risk Controls UI and RiskControlAssessment UI in the risk workflow.
8. Update Controls UI to show ControlImplementation linked risks.
9. Update Treatment modal copy and ensure TreatmentAction remains separate from RiskControl.
10. Update translations and frontend tests.
11. Run verification commands and fix only workflow-related issues.

## Risk areas and design cautions

- Route order: nested RiskControls routes must appear before [`riskRouter.get('/:id')`](backend/src/routes/risk.routes.ts:244), and ControlImplementation routes must appear before [`controlRouter.get('/:id')`](backend/src/routes/control.routes.ts:94).
- Schema mismatch: remove or fix invalid [`evidenceLinks`](backend/src/services/risk.service.ts:223) include in [`RiskService.getById()`](backend/src/services/risk.service.ts:205) before relying on detail loading.
- Semantic correctness: never infer RiskControl effectiveness from [`ControlImplementation.implementationStatus`](backend/prisma/schema.prisma:1304). Effectiveness belongs to [`RiskControlAssessment.effectivenessStatus`](backend/prisma/schema.prisma:805).
- Historical integrity: never mutate closed [`RiskAssessmentVersion`](backend/prisma/schema.prisma:748) records; create new versions for reassessments.
- Authorization: creating a RiskControl is a risk write operation and references a control implementation. At minimum require risks write; consider controls read or controls write depending on project policy.
- Duplicate links: uniqueness at [`@@unique([riskId, controlImplementationId])`](backend/prisma/schema.prisma:795) must be surfaced as a user-friendly conflict.
- Treatment separation: selecting a ControlImplementation in TreatmentAction must not auto-create a RiskControl or mark a control effective.
- Frontend data consistency: risk list preloading currently fetches details for only the first 20 risks at [`loadRisks()`](frontend/src/pages/Risks.tsx:116); use explicit lazy loading or nested list calls for rows beyond that range.

## Verification commands

Run these from the repository root after implementation:

1. `npm run build --workspace=shared`
2. `npm run build --workspace=backend`
3. `npm run test --workspace=backend -- normalized-risk-control-asset-overhaul.test.ts`
4. `npm run test --workspace=backend -- risk.assessment.test.ts`
5. `npm run test --workspace=backend -- route.order.test.ts`
6. `npm run test --workspace=backend`
7. `npm run build --workspace=frontend`
8. `npm run test --workspace=frontend -- --run`
9. `npm run build`

Optional manual API smoke checks after server startup:

1. POST `/api/v1/risks/:riskId/controls` with valid ControlImplementation, role, and mitigationDimension returns 201.
2. GET `/api/v1/risks/:riskId` returns riskControls with nested controlImplementation, control, and assessments.
3. POST `/api/v1/risks/:riskId/controls/:riskControlId/assessments` creates assessment on an open RiskAssessmentVersion and rejects a closed one.
4. GET `/api/v1/controls/implementations/:implementationId/risks` returns linked risks and latest effectiveness.
5. Creating a TreatmentAction with controlImplementationId does not create a RiskControl row.

## Definition of Done mapping

| Requirement | Done when |
| --- | --- |
| 1. Inspect schema, backend, shared, frontend, translations, tests | Findings above cite inspected schema, routes, services, DTOs, API client, UI pages, locale files, and tests. |
| 2a. Canonical RiskControl and no obsolete direct arrays | [`RiskControl`](backend/prisma/schema.prisma:780) remains canonical, obsolete Risk-Control payload fields are rejected, and no frontend/backend workflow uses direct Risk-Control arrays. |
| 2b. GET risk detail loads riskControls to controlImplementation to control and assessments | [`RiskService.getById()`](backend/src/services/risk.service.ts:205) returns nested RiskControls with ControlImplementation, Control, RiskControlAssessments, assessment version, and evidence. |
| 2c. REST endpoints under risks riskId controls | Nested RiskControl CRUD and assessment routes exist before generic param routes in [`risk.routes.ts`](backend/src/routes/risk.routes.ts:244). |
| 2d. ControlImplementation to Risks endpoint | [`control.routes.ts`](backend/src/routes/control.routes.ts:1) exposes GET implementation risks before [`/:id`](backend/src/routes/control.routes.ts:94). |
| 2e. RiskControlAssessment list/detail/create validation | Service and route layers support list/detail/create with same-risk checks, immutability checks, mandatory justification, allowed effectiveness status, evidence links, and HTTP 409 or 400 errors as appropriate. |
| 2f. Shared DTOs | [`shared/src/dtos/index.ts`](shared/src/dtos/index.ts:327) contains all nested route, payload, and query schemas and routes use validation middleware. |
| 2g. Frontend workflows | [`Risks`](frontend/src/pages/Risks.tsx:95) has a distinct Risk Controls and RiskControlAssessment workflow; [`Controls`](frontend/src/pages/Controls.tsx:88) shows linked risks per implementation; treatment modal stays separate. |
| 2h. Audit, authorization, validation, tests, translations | Audit actions are added in [`audit.service.ts`](backend/src/services/audit.service.ts:18), routes enforce entity authorization and Zod validation, tests cover service and route behavior, and locales in [`en.json`](frontend/src/locales/en.json:345) and [`de.json`](frontend/src/locales/de.json:345) include all new copy. |
| 2i. Remove implementationStatus equals effective logic | [`Risks.controlVerificationLabel()`](frontend/src/pages/Risks.tsx:174) uses latest RiskControlAssessment only; ControlImplementation status is displayed as readiness, not effectiveness. |
| 3. Plan file under plans | This file documents findings, proposed changes, sequencing, risk areas, verification commands, and Definition of Done. |
| 4. Do not implement code | Only this markdown plan file is added; no source implementation is changed. |

