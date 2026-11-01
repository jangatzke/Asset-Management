# Compliance Matrix — Asset Management System

> **Documentation Model Note:** This matrix distinguishes two dimensions:
> - **Application Coverage**: Can the application technically support this requirement?
> - **Organization Compliance Assessment**: Has the organization implemented the control and can provide evidence?
>
> All `status` values below refer to **application coverage only**. Organizational compliance requires separate audit evidence (policies, procedures, training records).
>
> **Forbidden wording:** "ISO 27001 compliant", "compliant with ISO 27001", "fully compliant" when claiming organizational compliance.

## Ticket Service Management — Application Coverage

| ID | Anwendungskontrolle | Status | Technische Evidenz | Organisatorische Nachweise |
|----|---------------------|--------|--------------------|----------------------------|
| TCK-601 | Tickets referenzieren nur valide Assets sowie bestehende aktive Requester, Assignees und Manager. | tested | `TicketAsset`, User-Foreign-Keys und Validierung in `ticket.service.ts`; Test `ticket.reference-validation.test.ts`. | Regelmäßige Berechtigungs- und Benutzer-Reviews. |
| TCK-602 | Administrativ geschütztes IMAP-/Exchange-OAuth2-Mail-to-Ticket-Gateway mit Sender-Mapping, Deduplizierung und Audit-Trail. | implemented | `EmailGatewayConfig`, `EmailMessage`, MSAL/IMAP-Service, cluster-sicherer Scheduler, Admin-UI und Audit-Ereignisse. | Freigabe der Exchange-App, Betrieb des Mailkontos, Aufbewahrung/Löschung und Secret-Management. |
| TCK-603 | E-Mail-Antworten werden anhand der Ticket-Display-ID als interne Ticket-Kommentare nachvollziehbar gespeichert. | implemented | Eingehende Nachrichten und Ticket-Kommentare referenzieren die Ticket-ID; Verarbeitungsstatus wird persistent gespeichert. | Prozess für die fachliche Bearbeitung der Kommentare. |

**Scope-Hinweis:** Diese Kontrollen beschreiben Anwendungsschutz und erzeugbare technische Evidenz. Sie ersetzen keine organisationsweiten Nachweise für ISO 27001 oder NIS-2.


<!-- NOTE: This file should be saved as docs/compliance-matrix.yml in code mode -->
<!-- YAML content below for reference during implementation -->

```yaml
- id: IAM-001
  title: Administrationsschutz
  priority: P0
  dimension: application_coverage
  status: implemented
  implementation:
    - backend/src/routes/admin.routes.ts
    - backend/src/middleware/auth.ts
    - backend/src/middleware/entityAuth.ts
    - backend/src/services/authorization.service.ts
  tests:
    - backend/src/__tests__/authorization.integration.test.ts
  gaps: []
  evidence:
    - requireAdminAccess prüft role.canAccessAdmin aus der Datenbank (entityAuth.ts), nicht Legacy-Rollennamen.

- id: IAM-002
  title: Entity-Level Authorization
  priority: P0
  status: implemented
  implementation:
    - backend/src/services/authorization.service.ts
    - backend/src/middleware/entityAuth.ts
    - backend/src/routes/asset.routes.ts
    - backend/src/routes/risk.routes.ts
    - backend/src/routes/control.routes.ts
    - backend/src/routes/incident.routes.ts
  tests:
    - backend/src/__tests__/authorization.integration.test.ts
  gaps: []
  evidence:
    - authorizationService.checkEntityPermission() und requireEntityPermission-Middleware schützen CRUD-Routen.
    - Permission-Aggregation über RolePermission-Zuweisungen (Legacy entityPermissions sind keine Runtime-Grants).

- id: IAM-003
  title: Routenreihenfolge und Konfliktfreiheit
  priority: P0
  status: implemented
  implementation:
    - backend/src/index.ts
  tests:
    - backend/src/__tests__/auth.routes.test.ts
    - backend/src/__tests__/route.order.test.ts
  gaps: []
  evidence:
    - Admin-Sub-Routen (/admin/vmware, /admin/proxmox) werden nach /admin gemountet – Reihenfolge korrekt.
    - Integrationstest für Route-Konflikte existiert (route.order.test.ts).

- id: SEC-001
  title: JWT-Härtung
  priority: P0
  status: implemented
  implementation:
    - backend/src/middleware/auth.ts
    - backend/src/services/auth.service.ts
  tests:
    - backend/src/__tests__/auth.service.test.ts
  gaps: []
  evidence:
    - Statische Fallback-Secrets entfernt; fehlender JWT_SECRET führt zu Fail-Fast in Production bzw. generiertem Development-Fallback (getJwtSecretStatus in auth.ts).
    - jwt.verify ist explizit auf HS256 beschränkt (JWT_ALGORITHMS in auth.ts).

- id: SEC-002
  title: OIDC – State, Nonce und PKCE
  priority: P0
  status: implemented
  implementation:
    - backend/src/services/oidc.service.ts
    - backend/src/routes/auth.routes.ts
  tests:
    - backend/src/__tests__/oidc.security.test.ts
  gaps: []
  evidence:
    - PKCE mit code_challenge/code_verifier (S256) implementiert (oidc.service.ts).
    - State wird über gehashten OidcLoginState-Datensatz validiert und einmalig verbraucht; Nonce wird generiert und gegen den ID-Token geprüft (expectedNonce).

- id: SEC-003
  title: CORS-Härtung
  priority: P0
  status: implemented
  implementation:
    - backend/src/index.ts
  tests:
    - backend/src/__tests__/cors.config.test.ts
  gaps: []
  evidence:
    - Kein Wildcard-Fallback; explizite Origins aus CORS_ORIGINS, sonst Fallback auf http://localhost:3000 (index.ts).

- id: SEC-004
  title: Passwort-Policy
  priority: P0
  status: implemented
  implementation:
    - backend/src/services/auth.service.ts
    - backend/src/utils/passwordValidation.ts
  tests:
    - backend/src/__tests__/auth.service.test.ts
  gaps: []
  evidence:
    - Passwortstärke-Validierung (min. 12 Zeichen, Groß-/Kleinbuchstaben, Ziffer, Sonderzeichen) in register(), createFirstAdmin(), createUser() und changePassword().

- id: SEC-005
  title: Zentrales Auditlog
  priority: P0
  status: implemented
  implementation:
    - backend/prisma/schema.prisma (AuditLog-Modell)
    - backend/src/services/audit.service.ts
    - backend/src/routes/auditLog.routes.ts
    - Integration in auth, admin, asset, risk, control, incident Services
  tests:
    - backend/src/__tests__/audit.service.test.ts
  gaps: []

- id: SEC-006
  title: Registrierungsschutz
  priority: P0
  status: implemented
  implementation:
    - backend/src/routes/auth.routes.ts
    - backend/src/services/auth.service.ts
    - Selbstregistrierung standardmäßig deaktiviert (ALLOW_SELF_REGISTRATION)
  tests:
    - backend/src/__tests__/auth.service.test.ts
    - backend/src/__tests__/auth.routes.test.ts
  gaps: []
  evidence:
    - Auth-Rate-Limiter (express-rate-limit) schützen Login, Refresh und OIDC-Endpunkte (auth.routes.ts).

- id: IAM-004
  title: Display-ID Generierung
  priority: P1
  status: implemented
  implementation:
    - backend/src/services/displayId.service.ts
    - Prisma DisplayIdCounter Modell mit sequenziellen Containern
    - Format: PREFIX-NNNN (z.B. ASSET-0001, RISK-0001)
  tests: []
  gaps: []

- id: AST-001
  title: Asset-Verantwortliche Bestätigung
  priority: P1
  status: implemented
  implementation:
    - backend/src/routes/asset.routes.ts (confirm-responsibility Endpoint existiert)
    - backend/prisma/schema.prisma (technicalOperator/businessOwner/informationSecurityResponsible als echte User-Relationen mit FK + @@index, ON DELETE SetNull)
    - backend/src/services/asset.service.ts (validateAssetOwnerReferences: Server-seitige Prüfung gegen aktive User, 400/409)
    - backend/prisma/migrations/20261026100000_user_owner_relations/migration.sql (Datenqualitäts-Reparatur + FK + Indizes)
    - docs/api/openapi.yaml (/users/owners Endpoint, AssetInput Owner-Felder, UserSelectItem Schema)
  tests: []
  gaps: []

- id: RSK-REF-1
  title: Risiko-Owner/Assessor referenzielle Integrität
  priority: P0
  status: implemented
  implementation:
    - backend/prisma/schema.prisma (riskOwner/riskAssessor als echte User-Relationen mit FK + @@index, ON DELETE Restrict)
    - backend/src/services/risk.service.ts (validateRiskUserReferences: 400 bei unbekannten, 409 bei inaktiven Usern)
    - backend/prisma/migrations/20261026100000_user_owner_relations/migration.sql (Orphan-Reassign auf aktiven system_admin + FK + Indizes)
    - backend/src/services/user.service.ts (getOwnersForSelect: aktive User für Owner-Picker, max. 500)
    - backend/src/routes/user.routes.ts (/users/owners Endpoint mit requireAdminAccess)
    - docs/api/openapi.yaml (RiskInput assessorId/riskOwnerId mit FK-Validierungsbeschreibung)
  tests: []
  gaps: []

- id: AST-002
  title: Vollständige Asset-Felder
  priority: P1
  status: implemented
  implementation:
    - backend/prisma/schema.prisma (Asset-Modell)
    - shared/src/types/asset.ts
    - shared/src/dtos/index.ts
    - backend/src/services/asset.service.ts
    - backend/src/routes/asset.routes.ts
  tests:
    - backend/src/__tests__/asset.crud.test.ts
  gaps: []

- id: AST-CRUD-2.2
  title: Asset-CRUD normalisiertes Schema, Bewertung, Lifecycle, Archivierung
  priority: P1
  status: implemented
  implementation:
    - shared/src/types/asset.ts (NetworkAddress[], M:N Junction-ID-Felder, CIA, Kritikalität, Compliance, Disposal)
    - shared/src/dtos/index.ts (Zod-Schemata für Asset-CRUD, Lifecycle, Archive/Restore, DisposalProof)
    - backend/prisma/schema.prisma (NetworkAddress, Junction Tables, archivedAt, Disposal-Felder, Compliance-Relevanz)
    - backend/src/services/asset.service.ts (Display-ID ASSET-0001, CRUD-Audit, Junction-Sync, Archivierung/Restore, Lifecycle-Transaktionen, DisposalProof)
    - backend/src/routes/asset.routes.ts (serverseitige Zod-Validierung, Admin-Archive/Restore, Lifecycle/Disposal Endpoints)
  tests:
    - backend/src/__tests__/asset.crud.test.ts
  gaps: []

- id: IMP-2.3
  title: Generisches Importframework für externe Asset-Quellen
  priority: P1
  status: implemented
  implementation:
    - backend/prisma/schema.prisma (IntegrationSource, ImportRun, ImportRecord, ImportConflict, FieldProvenance, FieldLock, SourcePriority)
    - backend/prisma/migrations/20260718113000_import_framework/migration.sql
    - backend/src/services/import.service.ts (Dry Run, Idempotenz, Business-Key-Dubletten, Konflikte, Feldsperren, Quellenpriorität, Stale-Markierung ohne Auto-Archivierung)
    - backend/src/routes/import.routes.ts (Import-Management, Locks, Prioritäten, Konfliktlösung)
    - backend/src/index.ts (/api/v1/imports)
  tests:
    - backend/src/__tests__/import.service.test.ts
  gaps: []

- id: RSK-001
  title: Prozessbasierte Risikobewertung
  priority: P1
  status: implemented
  implementation:
    - backend/prisma/schema.prisma (BusinessProcess-Modell, RiskProcess-Junction-Table)
    - backend/src/services/risk.service.ts
    - backend/src/routes/businessprocess.routes.ts
  tests:
    - backend/src/__tests__/businessprocess.service.test.ts
    - backend/src/__tests__/risk.assessment.test.ts
  gaps: []
  evidence:
    - affectedProcessIds String[] wurde durch die RiskProcess-Junction-Table ersetzt (schema.prisma).

- id: RSK-002
  title: Aggregierte Risikoverteilungen
  priority: P1
  status: implemented
  implementation:
    - backend/src/services/risk.aggregation.ts
    - backend/src/routes/risk.routes.ts
    - shared/src/types/risk.ts
  tests:
    - backend/src/__tests__/risk.aggregation.test.ts
  gaps: []
  evidence:
    - Aggregations-Endpoints unter /risks/aggregated/* in risk.routes.ts (Asset, Prozess, Service, Organisation, Risikoklasse, Status, AssessmentType).

- id: RSK-003
  title: Risiko-Behandlung und Risiko-Akzeptanz
  priority: P1
  status: implemented
  implementation:
    - backend/prisma/schema.prisma (RiskAcceptance, RiskTreatmentApproval, RiskTreatmentEffectivenessReview, Assessment-Referenzen)
    - backend/prisma/migrations/20260718160000_risk_treatment_acceptance_workflow/migration.sql
    - backend/src/services/risktreatment.service.ts (Pflichtfelder, Approval-Level, Vier-Augen-Prinzip, Wirksamkeitsprüfung, Abschluss-Assessment)
    - backend/src/routes/risktreatment.routes.ts (Approval, Effectiveness Review, Complete Endpoints)
    - backend/src/routes/risk.routes.ts (direkter /risks/:id/accept Bypass entfernt)
    - shared/src/types/risk.ts
    - shared/src/dtos/index.ts
  tests:
    - backend/src/__tests__/risktreatment.service.test.ts
  gaps: []

- id: CTL-001
  title: Statement of Applicability
  priority: P1
  status: implemented
  implementation:
    - backend/prisma/schema.prisma (StatementOfApplicability-Modell)
    - backend/src/routes/control.routes.ts
    - backend/src/services/control.service.ts
  tests:
    - backend/src/__tests__/phase4.service.test.ts
  gaps: []
  evidence:
    - SoA-Versionen mit Item-Begründungen; Workflow create/submit/approve/reject mit Immutabilität (control.service.ts).

- id: INC-001
  title: Incident-Bewertung und Meldefristen
  priority: P1
  status: implemented
  implementation:
    - backend/prisma/schema.prisma (IncidentAssessment, NotificationDeadline)
    - backend/src/routes/incident.routes.ts
    - backend/src/services/incident.service.ts
  tests:
    - backend/src/__tests__/phase5.service.test.ts
  gaps: []
  evidence:
    - NIS2-Meldefristen (24h/72h/Zwischen-/Monatsabschluss) werden automatisch aus dem geschützten Kenntniszeitpunkt erzeugt.

- id: AST-003
  title: Asset-Lebenszyklus-Protokollierung
  priority: P2
  status: implemented
  implementation:
    - backend/prisma/schema.prisma (AssetLifecycleLog-Modell)
    - backend/src/services/asset.service.ts (Lifecycle-Log bei Anlage, Statuswechsel, Decommission, Disposal und Responsibility-Bestätigung)
  tests: []
  gaps: []
  evidence:
    - tx.assetLifecycleLog.create wird in den Lifecycle-Transaktionen von asset.service.ts geschrieben.

- id: AST-004
  title: Erweiterte Bewertungsdimensionen
  priority: P2
  status: implemented
  implementation:
    - backend/prisma/schema.prisma (Asset-Modell)
  tests: []
  gaps: []

- id: AST-005
  title: Graphvisualisierung (AST-011)
  priority: P2
  status: implemented
  implementation:
    - backend/src/services/asset.graph.ts
    - frontend/src/components/AssetGraph.tsx
    - shared/src/types/graph.ts
  tests:
    - backend/src/__tests__/asset.graph.test.ts
  gaps: []
  evidence:
    - Paket 2.4 Graph-DTO unterstützt Asset, BusinessProcess, BusinessService, Risk, Control, Incident und Vulnerability Nodes.
    - Gesamtgraph lädt Assets inklusive isolierter Assets und erzeugt ISOLATED_ASSET Warnungen.
    - Relationstypabhängige Richtung umgesetzt (depends_on gerichtet, connected_to bidirektional, ownership Parent → Child).
    - Batch-Laden der Graph-Daten mit Cache für Gesamtgraphen.

- id: AST-006
  title: Impact Analysis (AST-012)
  priority: P2
  status: implemented
  implementation:
    - backend/src/services/asset.graph.ts
    - frontend/src/components/AssetImpactAnalysis.tsx
  tests:
    - backend/src/__tests__/asset.graph.test.ts
  gaps: []
  evidence:
    - Paket 2.4 mehrstufige Impact-Analyse behandelt Zyklen mit visited Sets.
    - Asset-Ausfall berechnet kaskadierende Auswirkungen auf Assets, Business Processes und Business Services.
    - Artikulationspunkte und Connectivity-Komponenten werden berechnet.
    - Redundante unabhängige Pfade und Redundanzgrad werden ausgewiesen.
    - Performance-Test mit 10.000 Assets und 50.000 Relationen ergänzt.

- id: RSK-TREATMENT-2
  title: Risikobehandlungspläne
  priority: P2
  status: implemented
  implementation:
    - backend/src/routes/risktreatment.routes.ts
    - backend/src/services/risktreatment.service.ts
  tests:
    - backend/src/__tests__/risktreatment.service.test.ts
  gaps: []
  evidence:
    - Acceptance-Validierung (Pflichtfelder, Approval-Level, Vier-Augen-Prinzip) ist implementiert; siehe RSK-003.

- id: UX-001
  title: Internationalisierung (i18n)
  priority: P2
  status: partial
  implementation:
    - frontend/src/context/I18nContext.tsx
    - frontend/src/locales/de.json
    - frontend/src/locales/en.json
  tests: []
  gaps: []

- id: UX-002
  title: Dark Mode
  priority: P2
  status: partial
  implementation:
    - frontend/src/context/DarkModeContext.tsx
  tests: []
  gaps: []

- id: OPS-001
  title: Intune-Integration
  priority: P3
  status: partial
  implementation:
    - backend/src/services/intune.service.ts
    - backend/src/services/intune.scheduler.ts
    - backend/src/routes/intune.routes.ts
  tests: []
  gaps: []

- id: OPS-002
  title: VMware vCenter-Integration
  priority: P3
  status: partial
  implementation:
    - backend/src/services/vcenter.service.ts
    - backend/src/routes/vmware.routes.ts
  tests: []
  gaps: []

- id: OPS-003
  title: Proxmox-Integration
  priority: P3
  status: partial
  implementation:
    - backend/src/services/proxmox.service.ts
    - backend/src/routes/proxmox.routes.ts
  tests: []
  gaps: []

- id: OPS-004
  title: Health Check und Monitoring
  priority: P3
  status: implemented
  implementation:
    - backend/src/index.ts (GET /health, /health/ready)
    - backend/src/middleware/health.ts
  tests:
    - backend/src/__tests__/phase8.health.test.ts
    - backend/src/__tests__/phase11.health-readiness.test.ts
  gaps: []
  evidence:
    - /health/ready prüft die DB-Konnektivität per SELECT 1 (siehe OPS-1101).
```

- id: UI-801
  title: EntityPicker-Komponente mit such-/paginierbarer Multi-Auswahl
  priority: P2
  status: implemented
  implementation:
    - frontend/src/components/EntityPicker.tsx
    - frontend/src/services/entityPickerApi.ts
  tests:
    - frontend/src/components/entityPickerUtils.test.ts
  gaps: []

- id: UI-802
  title: Raw UUID-Eingabefelder durch EntityPicker ersetzen
  priority: P2
  status: implemented
  implementation:
    - frontend/src/pages/ISMSPhase6.tsx (EntityPicker für ownerId, chairId, auditorIds, businessProcesses, resources, dependencies)
    - frontend/src/components/EntitySearchSelect.tsx (bestehende Single-Select Integration)
  tests: []
  gaps: []

- id: UI-803
  title: Security Requirements strukturierte UI statt JSON-Textarea
  priority: P2
  status: implemented
  implementation:
    - frontend/src/pages/ISMSPhase6.tsx (SecurityRequirements Dropdowns mit Kategorien und Status)
    - frontend/src/locales/en.json (securityRequirements translations)
    - frontend/src/locales/de.json (securityRequirements Übersetzungen)
  tests:
    - frontend/src/components/RiskDetail.test.ts (Security Requirements Serialisierung Tests)
  gaps: []

- id: UI-804
  title: Risk-Detail-Seite mit 7 Tabs
  priority: P2
  status: implemented
  implementation:
    - frontend/src/pages/RiskDetail.tsx (Overview, Assessment, Controls, Treatment, Evidence, History, Audit Tabs)
    - frontend/src/locales/en.json (riskDetail.tabs translations)
    - frontend/src/locales/de.json (riskDetail.tabs Übersetzungen)
  tests:
    - frontend/src/components/RiskDetail.test.ts (Tab-Struktur Tests)
  gaps: []

- id: UI-805
  title: i18n-Einträge für alle neuen UI-Texte
  priority: P2
  status: implemented
  implementation:
    - frontend/src/locales/en.json (entityPicker, ismsOperations.fields, securityRequirements, riskDetail.tabs)
    - frontend/src/locales/de.json (entityPicker, ismsOperations.fields, securityRequirements, riskDetail.tabs)
  tests: []
  gaps: []

## Status-Legende
| Status | Bedeutung |
|--------|-----------|
| `compliant` | Vollständig implementiert und getestet |
| `partial` | Teilweise implementiert, Lücken bekannt |
| `missing` | Nicht implementiert |
| `non_compliant` | Falsch implementiert (sicherheitskritisch) |

