# Requirements — Asset Management System

> **Documentation Model Note:** This document lists application requirements and their implementation status. It does **not** constitute organizational compliance certification. Application coverage for ISO 27001:2022 controls is documented in [`docs/compliance-matrix.yml`](compliance-matrix.yml) using the two-dimension model (Application Coverage vs. Organization Compliance Assessment).

**Version:** 1.0
**Date:** 2026-07-17
**Status:** Draft — Phase 0 verification baseline

## Phase 6 — Additional ISMS Modules

| ID | Priority | Category | Description | Acceptance criterion |
|---|---|---|---|---|
| SUP-601 | P1 | CTL | Supplier management must represent suppliers, assessments, and contract/risk relationships. | Criticality, data-protection/NIS2 relevance, assessment, review date, actions, and JSON/CSV export are available. |
| BCP-601 | P1 | OPS | Business impact analysis and business continuity must connect processes, services, and assets with MTPD/RTO/RPO. | BIA stores impact categories; BCP stores version, recovery strategies, exercises, findings, and due-date reminders. |
| AUD-601 | P1 | AUD | Audit management requires programmes, plans, findings, and evidence relationships. | Audit status, scope, auditor/audittee, findings, actions, and exports are persisted. |
| AUD-602 | P0 | AUD | AuditLog requires a hash chain with sequence, previousHash, and entryHash for tamper-evident logging. Integrity verification reports validity and the failing sequence. | Administrators can retrieve integrity status from `GET /admin/audit-integrity` without secret data. |
| CAPA-601 | P1 | AUD | Corrective actions must be creatable from audits, incidents, risks, controls, and suppliers. | CAPA stores source, owner, due date, status workflow, root cause, and effectiveness review. |
| TRN-601 | P1 | CTL | Training management requires courses, assignments, completions, acknowledgements, and escalations. | Due-date-based reminders support assignments; completion and acknowledgement are traceable. |
| MREV-601 | P1 | CTL | Management reviews must store agenda, inputs, decisions, actions, approval, and minutes. | Review actions have owner/due date; reviews can be approved and exported. |
| MET-601 | P1 | CTL | Security objectives, KPIs, and KRIs require metric definitions, values, thresholds, and breach detection. | MetricValue detects warning/critical breaches and the trend compared with the previous value. |
| TCK-601 | P0 | ITSM | Tickets must link one or more existing assets and reference existing active users as requester, assignee, and manager. | `TicketAsset` prevents duplicates; user foreign keys and service validation prevent unknown or inactive user references. |
| TCK-602 | P0 | ITSM | Incoming email must be convertible into tickets through IMAP and Exchange Online OAuth2. The sender is matched through `User.email`. | The gateway polls cluster-safely, deduplicates by RFC 822 `Message-ID`, records inbound/outbound messages, and creates an auditable ticket. |
| TCK-603 | P1 | ITSM | Replies to ticket confirmations must be stored traceably as internal ticket comments. | Ticket display ID maps replies; `EmailMessage` and `TicketComment` store content, mapping, and processing status. |
| TCK-604 | P1 | SEC | Only authorized administrators may manage mailbox, SMTP, and Exchange configuration; secrets must never be returned to clients. | `/admin/email-gateway` enforces authentication and admin access, audits changes, and returns only secret-configuration flags. |
| WFL-601 | P1 | OPS | A generic workflow engine must support definitions, instances, tasks, transitions, and approvals. | Workflows can be defined, instantiated, and advanced through validated transitions. |
| RPT-601 | P1 | AUD | Reporting and exports must be persisted, filterable, and auditable. | ReportRuns and ExportJobs store filters, format, payload, row count, and audit-log data. |

## Phase 10 — Background Job Cluster Safety

| ID | Priority | Category | Description | Acceptance criterion |
|---|---|---|---|---|
| JOB-1001 | P0 | OPS | Background jobs such as Intune sync and reminders must use PostgreSQL advisory locks for cluster safety. Only one worker per job type executes; concurrent instances are recorded as `skipped`. | `pg_try_advisory_lock` is acquired before execution and released in `finally`; each run is recorded in JobRun. |
| JOB-1002 | P1 | OPS | Every job run must record jobId, jobType, scheduled/start/finish times, status, workerId, error, and attempt. | The migration creates indexed `job_runs`; a Prisma model is available. |

## Phase 8 — API Maturity, Operations, and CI/CD Gates

| ID | Priority | Category | Description | Acceptance criterion |
|---|---|---|---|---|
| OPS-1101 | P0 | OPS | `/health/ready` must check database reachability, safe schema/migration status, and required-secret configuration. Optional integrations result in `degraded`, not `not_ready`. | Response contains structured healthy/degraded/not_ready status and checks. |
| OPS-1102 | P0 | SEC | Health status must not expose secrets or credentials. | It may list variable names such as `JWT_SECRET` but never their values. |
| OPS-1103 | P0 | OPS | `/metrics` must be protected through `METRICS_TOKEN` and expose Prometheus-compatible request, error, database, job, and integration metrics. | Valid token returns HTTP 200; no token returns HTTP 401. |
| OPS-1104 | P1 | OPS | Health middleware must expose registration APIs for custom and runtime health checks. | Failed registered checks mark the service as degraded. |
| INT-701 | P0 | SEC | Intune authentication must use MSAL Node and SecretStore-provided certificates; tokens and secrets must not be logged. | `.default` application permissions and `env:`/`file:` secret references work without default secrets. |
| INT-702 | P0 | SEC | Graph access must validate least-privilege application permissions. | Health checks clearly report a missing `DeviceManagementManagedDevices.Read.All` permission. |
| INT-703 | P1 | AST | Managed-device sync must select supported Graph fields, handle pagination, and respect HTTP 429 `Retry-After`. | All pages are processed and retry follows the response header. |
| INT-704 | P1 | AST | Sync must idempotently match/create assets, honor FieldLock, and write FieldProvenance. | Repeat sync creates no duplicate and locked fields remain unchanged. |
| INT-705 | P1 | AST | Removed Intune devices must not be automatically archived. | A full sync marks affected assets stale/requiring review after a grace period. |
| INT-706 | P1 | AUD | Sync, resync, health checks, and configuration changes must be audited and historized. | ImportRun and AuditLog include status, error counts, and partial-success results. |

## Phase 4 — Controls, SoA, Evidence, and Documents

| ID | Priority | Category | Description | Acceptance criterion |
|---|---|---|---|---|
| CTL-401 | P1 | CTL | Framework versions, requirements, and control mappings must be importable with versioning; license notices are mandatory. | Import creates immutable FrameworkVersion records; comparison shows added/removed/changed entries; controls can map to multiple requirements. |
| CTL-402 | P1 | CTL | Control implementations must represent implementation per scope, organization, or site. | Responsible party, maturity, test method/frequency, next review, findings, and actions are stored; one implementation may fulfil multiple requirements. |
| CTL-403 | P1 | CTL | A Statement of Applicability must use individual SoAItems instead of a single JSON object. | Items store applicability, rationale, status, controls, risks, and evidence and become immutable on approval. |
| EVD-401 | P1 | AUD | Evidence needs secure metadata with hash, classification, retention, and relationships. | SHA-256 hash, classification, retention/expiry, relationships, deletion protection, and audit-package export are enforced. |
| DOC-401 | P1 | AUD | Document control needs workflow, versioning, acknowledgement, and reviews. | Documents support draft, review, approval, publication, and withdrawal; approved versions are immutable and reviews may be escalated. |

## Phase 5 — NIS-2 and Incident Management

| ID | Priority | Category | Description | Acceptance criterion |
|---|---|---|---|---|
| NIS2-501 | P1 | CTL | NIS-2 applicability must be represented through a versioned questionnaire, preliminary assessment, and expert approval. | The assessment stores questionnaire version, answers, preliminary result, approval status, approver, and audit log. |
| NIS2-502 | P1 | CTL | NIS-2 registration requires deadline, contact/submission data, evidence, and change notifications. | Registration requires approved applicability; submission evidence and changes are persisted and audited. |
| NIS2-503 | P1 | CTL | The ten NIS-2 thematic areas must be integrated as requirements and controls in Phase 4. | An endpoint creates the NIS2 framework version, ten requirements, ten controls, mappings, and adequacy rationale. |
| INC-501 | P1 | INC | Materiality rules for NIS-2 incidents must be versioned and automatically create deadlines. | Reportable incidents create 24-hour, 72-hour, interim, and monthly-close deadlines from the time of awareness. |
| INC-502 | P1 | INC | The time of awareness is protected and may only change with a rationale. | Direct updates are rejected; a dedicated endpoint stores rationale, history, audit data, and recalculates open deadlines. |
| INC-503 | P1 | INC | A decision not to report requires rationale and approval. | A non-reportable decision without rationale or approver is rejected. |
| INC-504 | P1 | INC | Notification packages must be persisted and exportable. | 24-hour, 72-hour, interim, and monthly-close reports are stored and exported as a structured package. |
| INC-505 | P1 | INC | Incident closure requires root cause, lessons learned or action evaluation, and closure conditions. | Closure is rejected without root cause/action evaluation; material incidents require a submitted monthly close report. |

## Risk Aggregation RSK-AGG-3.4

| Field | Value |
|---|---|
| **ID** | RSK-AGG-3.4 |
| **Priority** | P1 |
| **Category** | RSK |
| **Description** | Risk aggregations must use normalized relationships only. Asset, process, and service references use `RiskAsset`, `RiskProcess`, and `RiskService`; removed ID arrays must not be used. |
| **Counting rules** | A risk is counted once in each group (`DISTINCT risk.id`). A risk with multiple assets/processes/services appears in every relevant group but is deduplicated within that group. |
| **Filtering rules** | `from` and `to` refer to `RiskAssessment.assessedAt`. Current metrics default to `isCurrent=true`; historical metrics are reproducible through method version, assessment type, and period. |
| **Acceptance criterion** | Aggregations are available by asset/type, process, service, organization, scope, risk class, status, and assessment type; junction tables and deduplication are used; aggregation avoids N+1; tests cover multiple assignments and filters. |

## Priority Requirements

### P0 — Security Critical

| ID | Category | Status | Description | Acceptance criterion |
|---|---|---|---|---|
| AUTHZ-001 | IAM | Implemented in Phase 1 | Administrative access must use granular permissions rather than implicit role names. | `administration.access` is modelled as a permission; direct/group roles and expiry are considered; tests cover administrative and group-role behavior. |
| AUTHZ-002 | IAM | Implemented in Phase 1 | Assets, risks, controls, incidents, and ISMS modules require granular permissions with optional legal-entity, organizational-unit, ISMS-scope, and site limits. | Shared AuthorizationService decisions filter lists/counts; out-of-scope access receives 403; tests cover all required scenarios. |
| IAM-001 | IAM | — | All `/api/v1/admin/*` routes must require a role with `canAccessAdmin = true`. | Middleware checks roles dynamically; unauthorized users receive 403; non-admin route tests pass. |
| IAM-002 | IAM | — | CRUD on assets, risks, controls, and incidents must check `entityPermissions`. | Readonly users receive 403 for writes; none users receive 403 for every operation. |
| IAM-003 | IAM | — | Specific Express routes must precede generic parameterized routes. | Static routes are registered first; no route shadowing exists; integration tests cover routes. |
| SEC-001 | SEC | — | JWT secrets must use environment configuration with no hard-coded fallback and explicit HS256 algorithm. | Startup fails without `JWT_SECRET`; HS256 is enforced; lifetime is no more than one hour. |
| SEC-002 | SEC | — | OIDC must use PKCE, state validation, and nonce validation against the ID token. | S256 challenge/verifier and server-side state/nonce generation, storage, and validation are implemented. |
| SEC-003 | SEC | — | Production CORS origins must not be wildcard. | `CORS_ORIGIN` is mandatory in production and incoming origins are validated. |
| SEC-004 | SEC | — | Registration and password changes require at least 12 characters, complexity, and bcrypt rounds of at least 10. | Weak passwords are rejected; rounds are configurable; plaintext is never logged or returned. |
| SEC-005 | AUD | — | Significant authentication, administration, CRUD, and configuration actions must be audit logged. | Logs include actor, action, object, timestamp, and applicable before/after values and cannot be deleted. |
| SEC-006 | SEC | — | Public registration is disabled by default; only explicit configuration enables it; first-admin setup is limited; auth routes are rate-limited. | Register is blocked without `ALLOW_SELF_REGISTRATION=true`; setup works only before an administrator exists; relevant auth/OIDC endpoints have per-IP limits. |

### P1 — High

| ID | Category | Description | Acceptance criterion |
|---|---|---|---|
| IAM-004 | IAM | Entity models need sequential predictable display IDs such as `USR-0001`, `AST-0001`, and `RSK-0001`. | IDs follow `{prefix}-{four-digit sequence}` and are unique per entity type. |
| AST-001 | AST | Technical operators, business owners, and information-security owners must be able to confirm their assignments. | Confirmation endpoint and audit log exist; unconfirmed assignments appear in the dashboard. |
| AST-002 | AST | Assets must cover contract/license references, vulnerability/incident relations, and document links. | Relations to Contract, License, Vulnerability, Incident, and Document are available. |
| RSK-001 | RSK | Risks must support both asset-based and process/scenario-based creation. | BusinessProcess has required relations and a risk may be created without an asset. |
| RSK-002 | RSK | APIs must aggregate risk by location, organizational unit, process, asset type, and ISMS scope. | Aggregation endpoint supports orgUnit, site, process, assetType, and ismsScope dimensions. |
| RSK-003 | RSK | Risk acceptance must use formal treatment/acceptance workflow tied to assessment versions; mitigation needs effectiveness review. | No direct bypass exists; acceptance requires rationale, expiry, and independent approval where required; all actions are authorized and audited. |
| RSK-004 | RSK | Risk methods and assessments must be immutably versioned. | RiskAssessment references RiskMethodVersion; safe calculation types avoid eval; previews persist nothing and historical assessments remain unchanged. |
| RSK-005 | RSK | Assessments must use relational, versioned scenario/threat/vulnerability/cause/impact data. | Relations and junction tables are used; historical assessments are never overwritten; rationale and review tasks are supported. |
| CTL-001 | CTL | Statement of Applicability must be created per framework version and ISMS scope with applicability assessment. | CRUD is available and all framework controls with applicability status are listed. |
| INC-001 | INC | Incident assessment must calculate and track notification deadlines. | Assessments create deadlines automatically and notify about upcoming due dates. |

### P2 — Medium

| ID | Category | Description | Acceptance criterion |
|---|---|---|---|
| AST-003 | AST | Asset lifecycle changes must be recorded; disposal needs destruction evidence. | Lifecycle logs are automatic and disposal requires evidence. |
| AST-004 | AST | Assets need personnel-safety, regulatory, financial-damage, and production-downtime dimensions. | Required fields exist in the Asset model. |
| AST-005 | AST | Frontend must visualize asset dependency graphs. | Graph APIs return node/edge data and the frontend renders an interactive graph. |
| AST-006 | AST | Impact analysis must calculate cascading effects of asset failure through graph traversal. | Impact API returns affected assets, processes, and services with configurable depth. |
| RSK-003 | RSK | RiskTreatment must support avoid, reduce, transfer, and accept. | Acceptance needs justification/expiry and expired acceptances appear in the dashboard. |
| UX-001 | UX | Frontend supports German and English with persistent user preference. | Both locale files, a language selector, and preference persistence exist. |
| UX-002 | UX | Frontend supports persistent dark and light modes. | A UI toggle, CSS variables, and preference persistence exist. |

### P3 — Low

| ID | Category | Description | Acceptance criterion |
|---|---|---|---|
| OPS-001 | OPS | Synchronize Intune devices and apps with local assets. | Configurable intervals, retry handling, and dashboard status are available. |
| OPS-002 | OPS | Import vCenter VMs into the asset database with credential management. | Servers are configurable; import supports dry-run and duplicate matching. |
| OPS-003 | OPS | Import Proxmox VE VMs/containers through API-token authentication. | Servers, VM/container import, and encrypted credentials are available. |
| OPS-004 | OPS | Detailed health checks cover database connectivity, background jobs, and sync health. | `/health` checks DB connectivity and `/health/detailed` returns service status. |

## Phase 0–5 Technical Consolidation and Hardening Work Packages

These requirements define ordered consolidation work. They are planning and traceability requirements only; Phase 0 does not claim functional implementation for later phases.

| ID | Phase | Priority | Category | Description | Acceptance criterion |
|---|---|---|---|---|---|
| AUTHZ-001 | 1 | P0 | Authorization | Consolidate route-level authorization so administrative APIs depend on role capability flags rather than legacy role-name checks. | Admin-only requests are denied with 403 unless an active role grants the required capability; tests cover allow and deny paths. |
| AUTHZ-002 | 1 | P0 | Authorization | Consolidate entity-level permissions for assets, risks, controls, and incidents. | Read, write, and delete use a shared decision path with tests for none, readonly, and readwrite roles. |
| AUTHN-001 | 2 | P0 | Authentication | Harden local-authentication bootstrap, self-registration, and authentication-endpoint rate limiting. | Self-registration is disabled by default, first-admin creation is single-use, and relevant endpoints are rate-limited. |
| AUTHN-002 | 3 | P0 | Authentication | Add MFA and password pre-authentication hardening before privileged local access. | Login uses explicit states and five-minute purpose-bound pre-auth tokens; MFA enrollment/verification and password-expiry change are supported; reset/re-enrollment is audited. |
| AUTHN-003 | 2 | P0 | Authentication | Browser sessions must use short-lived access JWTs and rotating database-backed refresh tokens in HttpOnly cookies. Refresh-token plaintext must never be stored server-side. | Cookie-only refresh works after access-token expiry; tokens rotate; reuse revokes/audits the family; logout revokes; disabled users cannot refresh; frontend uses single-flight retry. |
| OIDC-001 | 2 | P0 | OIDC | Harden OIDC state, nonce, PKCE, ID-token validation, and account linking. | PKCE S256, random backend state/nonce, hashed one-time state with TTL, strict validation, tenant mismatch rejection, and safe account linking are implemented. |
| AUD-001 | 4 | P0 | Audit | Consolidate audit logging for security-relevant authentication, authorization, administrative, and configuration events. | Entries include actor, action, object type/ID, timestamp, and applicable before/after values; records are append-only through the API. |
| DTO-001 | 4 | P1 | DTO/API | Consolidate shared DTO and validation contracts across backend/frontend boundaries. | Request/response schemas are shared or documented exceptions; backend validation consistently rejects invalid payloads. |
| UI-001 | 5 | P1 | UI | Align security-sensitive frontend flows with consolidated authentication, authorization, and DTO behavior without adding modules. | The UI consistently handles 401/403/429/validation errors and hides unauthorized operations. |
| OPS-013 | 0 | P0 | Operations | Establish reproducible technical-baseline documentation before functional refactoring. | Baseline records commit/date and build/test/lint/Prisma/CI status, counts, warnings, and known errors. |
| OPS-014 | 5 | P1 | Operations | Stop after Phase 5 for explicit verification and decision before later ISMS-module work. | Plans include a mandatory Phase 5 stop and no Phase 6+ implementation in this consolidation track. |
| API-501 | 5 | P1 | API consistency | Preserve Risk `description` and `possibleImpact` as separate fields through UI, validation, service, database, and read response. | Creating and reading a Risk returns both values unchanged. |
| API-502 | 5 | P1 | API consistency | Static API routes must precede overlapping `/:id` routes. | Focused collision tests cover audit export and comparable static routes. |
| UI-501 | 5 | P1 | UI/API integration | The Risk organization-unit picker must call an organization-unit endpoint rather than user search. | It uses `/api/v1/organization/units`, not `/users` or `/admin/users` search. |
| CI-003 | 0 | P0 | CI/CD | Document CI/CD workflow baseline and verification gaps before changing gates. | Existing jobs and known issues are recorded; missing/failing scripts are documented rather than replaced in Phase 0. |

## Phase 6 DTO/API Contract Requirements

- Target API resources **must** use shared DTO schemas as the primary request-contract source for create/update operations where practical.
- Asset, Risk, Control, ControlImplementation, RiskControl, RiskAssessment, and Incident POST/PATCH/PUT endpoints **must** use bounded Zod validation and must not use generic record-any schemas for domain CRUD payloads.
- Frontend API-client methods for affected resources **must** use concrete shared DTO request types where practical.
- Deprecated parallel risk-control/control mirror fields **must** be rejected in favour of RiskControl and EvidenceLink relationships.

## Phase 12 — CI/CD Release Gates

| ID | Priority | Category | Description | Acceptance criterion |
|---|---|---|---|---|
| CI-001 | P0 | CI/CD | The CI pipeline must include 13 mandatory jobs: build, lint, Prisma validation, unit tests, integration tests, frontend tests, Semgrep SARIF SAST, dependency scan, secret scan, SBOM, container scan, requirements check, and migration test. | All jobs are defined in `.github/workflows/ci.yml`; none is neutralized with `|| true`. |
| CI-002 | P0 | CI/CD | Release gates must be checklist-driven with mandatory review, test coverage of at least 80%, passed security scan, and changelog entry. The release-gates job depends on all mandatory jobs. | The `needs` list contains all jobs and a script checks each job status. |
| CI-003 | P0 | SEC | `npm audit` must not be neutralized. High/critical vulnerabilities block the pipeline; an explicit allowlist needs CVE, rationale, owner, and expiry date. | `npm audit --production --audit-level=high` runs without `|| true`; the allowlist validation script runs. |
| CI-004 | P1 | SEC | Semgrep SAST must create SARIF and upload it with `upload-sarif@v3`; JSON-only output is insufficient. | It uses `--output-format=sarif --output=semgrep-results.sarif` and uploads that file. |
| CI-005 | P1 | OPS | Migration test runs against an empty PostgreSQL database with deploy, seed, and integration tests. | CI runs `prisma migrate deploy`, database seed, and tests against a fresh migration. |
| CI-006 | P1 | OPS | Requirements check rejects P0/P1 missing/non-compliant items; partial status requires a documented exception and evidence references. | It exits 0 on success and 1 on failure and runs as a dedicated CI job. |

## Phase 14 — Code Quality and Architecture

| ID | Priority | Category | Description | Acceptance criterion |
|---|---|---|---|---|
| CQ-1401 | P1 | OPS | Repeated status colors and error extraction must be centralized in shared helpers. | `frontend/src/utils/statusHelpers.ts` provides `getRiskColor`, `getControlStatusColor`, `getStatusColor`, and `getErrorMessage`; consumers import them. |
| CQ-1402 | P1 | OPS | TypeScript catch blocks must not use implicit `any`. | `catch (err: any)` is replaced by `catch (err: unknown)` with type-safe extraction; no new `any` is introduced in refactored code. |
| CQ-1403 | P1 | OPS | Large components must become more maintainable through helper-function extraction. | Inline `getStatusColor`/`getRiskColor` functions are removed from Risks.tsx and Controls.tsx, reducing duplication. |

## Glossary

| Field | Description |
|---|---|
| **ID** | Unique requirement identifier (category-number) |
| **Priority** | P0 = security critical; P1 = high; P2 = medium; P3 = low |
| **Category** | IAM = identity/access; SEC = security; AST = asset; RSK = risk; CTL = control; INC = incident; AUD = audit; UX = user experience; OPS = operations |
| **Acceptance criterion** | Verifiable condition for fulfillment |
