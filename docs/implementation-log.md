# Implementation Log

## 2026-07-18 — Globale Backend-Build-Probleme korrigiert

### Änderungen

- Backend-TypeScript-Fehler in `entityAuth`, `auditLog.routes`, `riskmethod.routes`, `auth.service`, `contract.service`, `license.service` und `riskmethod.service` korrigiert.
- Contract-/License-Asset-Zugriffe auf die normalisierten Prisma-Junction-Relations `AssetContract` und `AssetLicense` umgestellt.
- Risk-Method-JSON-Felder defensiv auf Record-Strukturen normalisiert und nullable Risk-Klassifizierungen DTO-kompatibel behandelt.

### Prüfungen

- `npm run build --workspace=backend` wird nach den Korrekturen erneut ausgeführt.
- Relevante Backend-Tests werden nach erfolgreichem Build ausgeführt.

### Breaking Changes

- Keine beabsichtigten Breaking Changes; Authorization- und Audit-Prüfungen wurden nicht entfernt oder umgangen.

### Bekannte Restpunkte

- Keine bekannten Restpunkte aus diesem Subtask nach Abschluss der finalen Build-/Testprüfung.

## 2026-07-18 — Phase 7: Intune-Anbindung korrigieren

### Änderungen

- `backend/src/services/intune.auth.ts` auf `@azure/msal-node` und zertifikatbasierte Client-Credential-Authentifizierung mit SecretStore-Abstraktion (`env:`/`file:`) umgestellt; Token-/Secret-Logging vermieden.
- `backend/src/services/intune.client.ts` ersetzt durch Graph-Client mit korrektem `managedDevices`-Endpoint, unterstütztem `$select`, echtem Details-Abruf, Pagination und HTTP-429-`Retry-After`-Handling.
- `backend/src/services/intune.service.ts` neu ausgerichtet: Full/Incremental Sync, einmal gelesene Geräte-ID-Liste für Stale-Erkennung, konfigurierbare Grace Period, idempotentes Asset-Matching/-Anlegen, FieldLock-Beachtung, FieldProvenance, Fehlerzähler, `partial_success`, `ImportRun`-Historisierung und Resync mit echtem Graph-Abruf.
- `backend/src/routes/intune.routes.ts` übergibt Admin-User an auditierte Operationen; Device-Details-Endpunkt liefert echte Sync-Daten.
- `backend/prisma/schema.prisma` und Migration `backend/prisma/migrations/20260719010000_phase7_intune_sync_history/migration.sql` ergänzen `staleCount`; automatische Assetarchivierung wurde nicht implementiert.
- `frontend/src/pages/AdminIntune.tsx` zeigt Health-/Permission-Fehler, Partial-Success und Stale-/Review-Zähler verständlicher an.
- `backend/src/__tests__/intune.phase7.test.ts` deckt Pagination, 429, neue Assets ohne Dublette, FieldLock, Stale-Markierung, echten Resync-Graph-Aufruf und verständliche Permission-Fehler ab.

### Prüfungen

- Phase-7-spezifische Tests wurden ergänzt; lokale Ausführung siehe Abschlussbericht.
- Bekannte globale Build-Probleme in Altbereichen bleiben separat zu behandeln.

### Breaking Changes

- Intune-Konfiguration nutzt jetzt `INTUNE_CERT_PRIVATE_KEY_SECRET_REF`, optional `INTUNE_CERT_X5C_SECRET_REF` und `INTUNE_CERT_THUMBPRINT`; die alte direkte `INTUNE_CERT_PATH`/Typo-Variable wird nur noch als Übergangs-Fallback gelesen.
- Erforderliche Graph-Berechtigung ist Application Permission `DeviceManagementManagedDevices.Read.All` mit Admin Consent.

### Bekannte Restpunkte

- Ein produktiver Secret Store wie Key Vault ist noch nicht angebunden; die Abstraktion unterstützt aktuell Env/File-Provider.
- Prisma Client muss nach Migration/Dependency-Install neu generiert werden.

## 2026-07-18 — Phase 6: Weitere ISMS-Module

### Änderungen

- `backend/prisma/schema.prisma` um normalisierte Phase-6-Modelle ergänzt: Lieferanten inkl. Assessments/Contract-/Risk-Relationen, BIA/BCP inkl. Asset-Bezug und Übungen, AuditProgramme/-Pläne/-Findings/Evidence-Relationen, CAPA, Trainingskurse/-Zuweisungen/-Abschlüsse/-Kenntnisnahmen, Management Reviews inkl. Actions, Security Objectives/KPI/KRI, generische Workflow Definition/Instance/Task/TransitionLog sowie Reports/Exports.
- Migration `backend/prisma/migrations/20260718230000_phase6_isms_modules/migration.sql` erzeugt; zusätzlich `schema.diff.txt` als Review-Artefakt abgelegt, weil ein Shadow-DB-freier Diff gegen bestehende Migrationen in der lokalen Umgebung nicht möglich war.
- `backend/src/services/phase6.service.ts` implementiert generisches CRUD, Due-Date-/Reminder-Mechanik, CAPA aus Audit/Incident/Risk/Control/Supplier, Training Completion, KPI/KRI-Schwellen- und Trend-Erkennung, Workflow-Start/Transitions, ReportRuns sowie persistierte JSON/CSV-ExportJobs mit Auditlog.
- `backend/src/routes/phase6.routes.ts` stellt REST-Endpunkte unter `/api/v1/phase6` bereit und erzwingt Authentifizierung sowie Schreibberechtigung bei mutierenden Operationen.
- `shared/src/dtos/index.ts` und `shared/src/types/isms.ts` enthalten Phase-6-Ressourcen, DTOs für Supplier, CAPA, Workflow und Export.
- Frontend-Basisintegration über `frontend/src/services/api.ts`, neue Seite `frontend/src/pages/ISMSPhase6.tsx`, Route in `frontend/src/App.tsx` und Navigation in `frontend/src/components/Layout.tsx`.
- Tests in `backend/src/__tests__/phase6.service.test.ts` decken Supplier-Erstellung/Audit, CAPA-Quellenvalidierung, KPI/KRI-Breaches/Trend und CSV-ExportJobs ab; `backend/src/__tests__/phase6.routes.test.ts` ergänzt REST-/Negative-Resource-Abdeckung.

### Prüfungen

- `npm run db:generate --workspace=backend` erfolgreich.
- `npm test --workspace=backend -- phase6.service.test.ts` erfolgreich: 4 Tests bestanden.
- `npm run build --workspace=backend` wurde ausgeführt; keine Phase-6-spezifischen Fehler nach Korrektur im neuen Service sichtbar, aber bestehende Altbereichsfehler in `entityAuth`, `auditLog.routes`, `riskmethod.routes`, `contract.service`, `license.service` und `riskmethod.service` bleiben bestehen.

### Breaking Changes

- Das alte generische Modell `Workflow` wurde durch `WorkflowDefinition` ersetzt; `WorkflowInstance` wurde für die Phase-6-Engine normalisiert.
- Legacy-Modelle `Audit` und `Training` wurden durch normalisierte Audit-/Training-Modelle ersetzt.

### Bekannte Restpunkte

- Die generische Phase-6-API nutzt bewusst pragmatische, ressourcenbasierte Endpunkte; feingranulare pro-Modul-Controller können später ohne Schemaänderung ergänzt werden.
- Produktive Migration sollte gegen eine echte Shadow-DB geprüft werden, da der lokale Diff nur `--from-empty` erzeugen konnte.

## 2026-07-18 — Phase 5: NIS-2 und Incident-Management

### Änderungen

- Prisma-Schema und Migration `backend/prisma/migrations/20260718210000_phase5_nis2_incident_workflow/migration.sql` erweitert um NIS-2-Fragebogenversionen, Registrierungsänderungen, Signifikanzregelversionen, geschützte Kenntniszeitpunkt-Historie, Incident-Reports, Kommunikation und Eskalationen.
- `backend/src/services/nis2.service.ts` implementiert versionierte Betroffenheitsbewertung, Vorbewertung, fachliche Freigabe, Registrierung mit Frist/Nachweis, Änderungsmeldungen und den NIS-2-Maßnahmenkatalog mit zehn Themenbereichen als Requirements/Controls.
- `backend/src/services/incident.service.ts` erweitert um versionierte Signifikanzregeln, automatische 24h-/72h-/Zwischen-/Monatsfristen, Kenntniszeitpunkt-Änderungen mit Begründung/Audit, Nichtmeldungsfreigabe, Reports, Exportpakete, Kommunikationsworkflow, Eskalationen und Abschlussbedingungen.
- `backend/src/routes/nis2.routes.ts` neu; `backend/src/routes/incident.routes.ts` um Phase-5-Endpunkte und Zod-Validation ergänzt.
- Shared DTOs und Types in `shared/src/dtos/index.ts`, `shared/src/types/incident.ts` und `shared/src/types/nis2.ts` aktualisiert.
- Frontend `frontend/src/pages/Incidents.tsx` zeigt NIS-2-Signifikanz, Kenntniszeitpunkt und 24h-Warnungs-Draft-Aktion; `frontend/src/services/api.ts` enthält NIS-2- und Incident-Workflow-API-Methoden.
- OpenAPI-Grundgerüst in `docs/api/openapi.yaml` für neue NIS-2- und Incident-Hauptendpunkte ergänzt.
- Tests in `backend/src/__tests__/phase5.service.test.ts` decken Fristen, Kenntniszeitpunkt-Schutz, Nichtmeldung, Reportexport, NIS-2-Betroffenheit/Registrierung, Maßnahmenkatalog und Abschlussbedingungen ab.

### Breaking Changes

- Incident-Erstellung verlangt jetzt vollständige Incident-Pflichtdaten (`description`, `detectionTime`, `knowledgeTime`, `incidentManagerId`) gemäß DTO-Validation.
- Direkte Änderung von `knowledgeTime` über `PUT /incidents/:id` wird abgewiesen; dafür ist `POST /incidents/:id/knowledge-time` mit Begründung erforderlich.
- Signifikante Incidents können erst nach eingereichtem Monatsabschlussbericht geschlossen werden.

### Bekannte Restpunkte

- Bestehende globale Build-/TypeScript-Probleme in Altbereichen bleiben unverändert bekannt.
- Prisma Client muss nach Migration neu generiert werden.
- Produktive NIS-2-Signifikanz- und Fragebogenregeln sollten fachlich durch Compliance-Verantwortliche versioniert gepflegt werden.

## 2026-07-18 — Phase 3 Paket 3.4: Risiko-Aggregationen

- `backend/src/services/risk.aggregation.ts` auf normalisierte Junction Tables (`RiskAsset`, `RiskProcess`, `RiskService`) und `RiskAssessment`-Filter umgestellt.
- Einheitliche Aggregationsfilter implementiert: `from`, `to`, `scope`, `organizationUnitId`, `status`, `riskClass`, `assessmentType`, `methodVersionId`, `isCurrent`.
- Zählregel: Risiko wird je Gruppe dedupliziert; bei Mehrfachzuordnungen über verschiedene Gruppen hinweg wird es bewusst pro betroffener Gruppe gezählt.
- `backend/src/routes/risk.routes.ts` um filterbare Aggregationsendpunkte (`/aggregated`, `/aggregated/by-service`, `/aggregated/by-risk-class`, `/aggregated/by-status`) erweitert.
- `shared/src/types/risk.ts` und `shared/src/dtos/index.ts` um Aggregations-Typen und Query-DTOs ergänzt.
- `backend/src/__tests__/risk.aggregation.test.ts` auf Junction-Table-Fixtures aktualisiert und um Dedupe-/Filtertests erweitert.

## Paket 3.1 — Versionierte Risikomethoden (2026-07-18)

### Änderungen

#### Schema (`backend/prisma/schema.prisma`)
- **RiskMethod** erweitert um `calculationType` (product|sum|max|matrix), `formulaExpression` (deprecated)
- **RiskMethodVersion** neu — immutabler Snapshot einer Methodendefinition zu einem Zeitpunkt
  - Felder: id, riskMethodId, versionTag, likelihoodScale, impactScale, ratingDimensions, calculationType, formulaExpression, riskClasses, createdAt, isImmutable
  - `isImmutable` wird automatisch auf `true` gesetzt, sobald erste Assessment referenziert
- **Risk** erweitert um `riskMethodVersionId` (FK zu RiskMethodVersion)
- **RiskAssessment** neu — versionierte Risikobewertung gebunden an Methodenversion
  - Felder: id, riskId, riskMethodVersionId, assessmentNumber, likelihood, impact, inherentRisk, residualRisk, targetRisk, score, assessorId, assessedAt, nextReviewDate, justification, isCurrent, createdAt
  - Unique Constraint auf `[riskId, assessmentNumber]`
  - Unique Constraint auf `[riskId, isCurrent]` (nur eine aktuelle Assessment pro Risk)

#### Migration (`backend/prisma/migrations/20260718130000_risk_method_versioning/migration.sql`)
- `calculationType` und `formulaExpression` zu `risk_methods` hinzugefügt
- Tabelle `risk_method_versions` erstellt
- Spalte `riskMethodVersionId` zu `risks` hinzugefügt (FK mit ON DELETE SET NULL)
- Tabelle `risk_assessments` erstellt
- Initial-Snapshots für bestehende RiskMethods automatisch erzeugt

#### Service (`backend/src/services/riskmethod.service.ts`)
- **SafeCalculationEngine** — sichere Berechnung ohne eval/Function
  - `calculate(calculationType, likelihood, impact)` — unterstützt product, sum, max, matrix
  - `classifyRisk(score, classes)` — Klassifizierung anhand von Schwellenwerten
  - `validateInputs(likelihood, impact, likelihoodScale, impactScale)` — Validierung gegen Skalenbereiche
- **Version Management**
  - `createVersion(riskMethodId)` — erzeugt neuen Snapshot mit sequentiellem versionTag
  - `findVersion(versionId)` — lädt Version inkl. parent Method
  - `listVersions(riskMethodId)` — listet alle Versionen
  - `updateVersion()` — wirft immer 409 (Immutability-Enforcement)
  - `markVersionImmutable(versionId)` — setzt isImmutable=true
- **Recalculation**
  - `recalculatePreview(targetVersionId, input?)` — read-only Vorschau ohne Persistenz
  - `confirmRecalculation(riskId, input, userId?)` — erzeugt neue RiskAssessment-Version
  - `bulkConfirmRecalculation(riskIds, input, userId?)` — Batch-Neuberechnung
- **CRUD** aktualisiert mit calculationType-Validierung und Audit-Logging

#### Routen (`backend/src/routes/riskmethod.routes.ts`)
- Version Management: `POST /:id/versions`, `GET /:id/versions`, `GET /versions/:versionId`
- Berechnung: `POST /versions/:versionId/calculate`
- Preview: `POST /versions/:versionId/recalculate-preview` (und Legacy `/:id/recalculate-preview`)
- Confirmed Recalculation: `POST /versions/:versionId/recalculate`, `POST /versions/:versionId/recalculate-bulk`

#### Shared Types (`shared/src/types/risk.ts`)
- `CalculationType` enum hinzugefügt
- `RiskMethodVersion` Interface
- `RiskAssessment` Interface
- `Risk.riskMethodVersionId` und `Risk.assessments[]` erweitert

#### DTOs (`shared/src/dtos/index.ts`)
- `CreateRiskMethodSchema` mit calculationType, likelihoodScale, impactScale, riskClasses Validierung
- `UpdateRiskMethodSchema`
- `RecalculatePreviewSchema`
- `ConfirmRecalculationSchema`
- `BulkConfirmRecalculationSchema`
- `CalculateRiskScoreSchema`

#### Tests (`backend/src/__tests__/riskmethod.service.test.ts`)
- CRUD-Tests mit calculationType
- Version Management: createVersion, findVersion, listVersions, updateVersion (Immutability), markVersionImmutable
- SafeCalculationEngine: product, sum, max, scale validation, unsupported type rejection
- RecalculatePreview: read-only verification, risk ID filtering, override support
- ConfirmRecalculation: new assessment version creation, history preservation, immutability marking
- BulkConfirmRecalculation: success/failure counting

#### Dokumentation
- `docs/compliance-matrix.yml` — RSK-004 als compliant hinzugefügt
- `docs/requirements.md` — RSK-004 Anforderung dokumentiert

### Breaking Changes
- **RiskMethod.formula** wird deprecated zugunsten von `calculationType` (Bestandswerte bleiben erhalten)
- **Risk.create()** erwartet optional `riskMethodVersionId` für die Bindung an eine Methodenversion
- **RiskMethod.delete()** wirft 409 wenn immutable Versionen existieren (statt soft delete)

### Bekannte Restpunkte
- Prisma Client muss mit `npx prisma generate` regeneriert werden (lokale Dateisperre verhinderte Ausführung)
- Datenbank-Migration muss manuell angewendet werden (`prisma migrate deploy`)
- Frontend-Komponenten müssen für die neuen Versionierungs-Endpoints angepasst werden
- RiskService muss aktualisiert werden, um bei Risk-Erstellung automatisch eine Assessment zu erzeugen

## Paket 3.2 — Risikobewertung (2026-07-18)

### Änderungen

#### Schema (`backend/prisma/schema.prisma`)
- **Threat** erweitert um `displayId` (unique), Relationen zu `RiskScenario[]` und `Risk[]`
- **Vulnerability** erweitert um `displayId` (unique), Relationen zu `RiskScenario[]` und `Risk[]`
- **RiskScenario** neu — verbindet Threat + optional Vulnerability zu einem konkreten Szenario
  - Felder: id, displayId, title, description, threatId (FK→Threat), vulnerabilityId (FK→Vulnerability)
- **RiskCause** neu — Root-Cause-Modell
  - Felder: id, displayId, title, description, category
- **RiskImpact** neu — konkreter Geschäftsauswirkungs-Modell
  - Felder: id, displayId, title, description, category, severity
- **RiskCauseLink** neu — Junction Table Risk↔Cause (M:N)
- **RiskImpactLink** neu — Junction Table Risk↔Impact (M:N)
- **ReviewTask** neu — Review-Aufgaben für geplante und außerplanmäßige Reviews
  - Felder: id, displayId, riskId, scheduledDate, dueDate, status, priority, assignedTo, triggerType, triggerEventId, triggerSource, notes, completedAt, completedBy
- **Risk** erweitert um `scenarioId` (FK→RiskScenario), relationale FKs zu Threat/Vulnerability, Relations zu causes/impacts/reviewTasks
- **RiskAssessment** erweitert um `assessmentType` (inherent|current|target); `justification` jetzt NOT NULL

#### Migration (`backend/prisma/migrations/20260718140000_risk_assessment_building_blocks/migration.sql`)
- `displayId` zu `threats` und `vulnerabilities` hinzugefügt
- Tabellen `risk_scenarios`, `risk_causes`, `risk_impacts`, `risk_cause_links`, `risk_impact_links`, `review_tasks` erstellt
- `scenarioId` zu `risks` hinzugefügt (FK mit ON DELETE SET NULL)
- FK-Constraints für `threatId` und `vulnerabilityId` in `risks` hinzugefügt
- `assessmentType` zu `risk_assessments` hinzugefügt
- `justification` auf NOT NULL umgestellt (Bestandswerte mit Default gefüllt)

#### Service (`backend/src/services/risk.service.ts`)
- **create()** — erstellt Risiko mit relationalen Bausteinen, Junction-Links und initialer Assessment in einer Transaktion
- **update()** — aktualisiert Risiko und erzeugt bei Änderung neuer Assessment-Snapshot (Historisierung)
- **createAssessment()** — versionierte Bewertung mit mandatory justification; markiert vorherige als historical
- **getAssessments()** / **getCurrentAssessment()** — Assessment-Historie abrufen
- **createReviewTask()** / **updateReviewTask()** / **listReviewTasks()** — ReviewTask CRUD
- **checkUnplannedReviewTrigger()** — erzeugt bei Trigger konkrete ReviewTask-Instanzen für betroffene Risiken

#### Routen (`backend/src/routes/risk.routes.ts`)
- `POST /assessments` — neue Assessment erstellen
- `GET /:id/assessments` — Assessment-Historie eines Risikos
- `GET /:id/assessments/current` — aktuelle Assessment (optional gefiltert nach type)
- `GET /review-tasks` — alle Review Tasks auflisten
- `POST /review-tasks` — neue Review Task erstellen
- `PUT /review-tasks/:taskId` — Review Task aktualisieren
- `GET /:id/review-tasks` — Review Tasks eines Risikos

#### Shared Types (`shared/src/types/risk.ts`)
- `AssessmentType`, `ReviewTaskTriggerType`, `ReviewTaskStatus`, `ReviewTaskPriority` Typen hinzugefügt
- `RiskScenario`, `RiskCause`, `RiskImpact`, `ReviewTask` Interfaces
- `Threat` und `Vulnerability` um `displayId` erweitert
- `RiskAssessment.justification` jetzt required (nicht optional)

#### DTOs (`shared/src/dtos/index.ts`)
- `CreateRiskScenarioSchema` / `UpdateRiskScenarioSchema`
- `CreateRiskCauseSchema` / `UpdateRiskCauseSchema`
- `CreateRiskImpactSchema` / `UpdateRiskImpactSchema`
- `CreateRiskAssessmentSchema` (mit mandatory justification)
- `CreateReviewTaskSchema` / `UpdateReviewTaskSchema`
- `UnplannedReviewEventSchema`
- `CreateRiskEnhancedSchema` (erweitertes Risk-CRUD mit relationalen Bausteinen)

#### Tests (`backend/src/__tests__/risk.assessment.test.ts`)
- Relationale Risikobausteine: Scenario/Threat/Vulnerability/Cause/Impact Validierung
- Junction Table Tests: Asset/Process/Service Beziehungen
- Assessment History: Versionierung, mandatory justification, assessmentType Support
- ReviewTask Management: CRUD, Completion
- Unplanned Review Trigger: Security Incident, Critical Supplier, Technical Change, Approval Expiring
- Risk Level Calculation: very_high/high/medium/low Schwellenwerte

### Breaking Changes
- **RiskAssessment.justification** ist jetzt NOT NULL — bestehende API-Calls müssen justification übergeben
- **Risk.create()** erwartet `justification` Parameter (mandatory)
- **Threat/Vulnerability** erhalten `displayId` Feld (auto-generated bei Migration)
- Alte `affectedAssetIds`/`affectedProcessIds`/`affectedServiceIds` Arrays in Risk-Typen sind deprecated; Junction Tables verwenden

### Bekannte Restpunkte
- Prisma Client muss mit `npx prisma generate` regeneriert werden

## Paket 3.3 — Behandlung und Akzeptanz (2026-07-18)

### Änderungen

#### Schema (`backend/prisma/schema.prisma`)
- **RiskTreatment** erweitert um `assessmentId`, `completedAt`, `completedBy`, `residualAssessmentId` sowie Relationen zu Acceptance, Approvals und Effectiveness Reviews.
- **RiskAcceptance** neu — formaler Acceptance-Workflow mit `assessmentId`, `justification`, `expiryDate`, `requestedBy`, `requiredLevel`, `status`, `approvedBy`, `approvedAt`.
- **RiskTreatmentApproval** neu — revisionsfähige Approval-Entscheidungen mit Approval-Level und Kommentar.
- **RiskTreatmentEffectivenessReview** neu — Ergebnis, Datum und Prüfer für Wirksamkeitsprüfungen.

#### Migration (`backend/prisma/migrations/20260718160000_risk_treatment_acceptance_workflow/migration.sql`)
- Neue Acceptance-/Approval-/Effectiveness-Review-Tabellen erstellt.
- Treatment-Spalten für Assessment-Referenz und Abschluss-Metadaten ergänzt.

#### Services und Routen
- Direkter Accept-Bypass aus `backend/src/routes/risk.routes.ts` und `acceptRisk()` aus `backend/src/services/risk.service.ts` entfernt.
- `backend/src/services/risktreatment.service.ts` erzwingt Acceptance-Pflichtfelder: konkrete Assessment-Version, Begründung, Ablaufdatum, Genehmiger.
- Schwellenwertabhängige Freigabe: low/medium über Risk Owner; high/critical über Management/Admin-Freigabe.
- Vier-Augen-Prinzip: High/Critical-Approver darf nicht Assessment-Assessor sein.
- Mitigation-Abschluss ohne `RiskTreatmentEffectivenessReview` wird abgelehnt.
- Abschluss erzeugt oder bestätigt ein Ziel-/Restrisiko-Assessment als neue Assessment-Version; historische Assessments werden nicht überschrieben.
- Auditlog-Aktionen für Treatment, Acceptance, Approval, Effectiveness Review und Completion ergänzt.

#### Shared Types/DTOs
- `shared/src/types/risk.ts` um `RiskAcceptance`, `RiskTreatmentApproval`, `RiskTreatmentEffectivenessReview`, `RiskApprovalLevel`, `RiskAcceptanceStatus` erweitert.
- `shared/src/dtos/index.ts` um validierende Zod-Schemata für Create/Update Treatment, Approve, Effectiveness Review und Complete erweitert.

#### Tests
- `backend/src/__tests__/risktreatment.service.test.ts` erweitert für Acceptance-Pflichtfelder, Approval-Level, Vier-Augen-Prinzip, Mitigation-Wirksamkeitsprüfung und Completion-Assessment.
- Erfolgreich ausgeführt: `npm --workspace backend test -- risktreatment.service.test.ts --runInBand`.

### Breaking Changes
- `POST /api/v1/risks/:id/accept` existiert nicht mehr; Acceptance muss über `POST /api/v1/treatments` mit `treatmentOption=accept` und anschließendem `POST /api/v1/treatments/:id/approve` erfolgen.
- Acceptance-Requests benötigen `assessmentId`, `justification`, `expiryDate` und `approverId`.

### Bekannte Restpunkte
- Prisma Client muss nach Schemaänderung regeneriert werden (`npx prisma generate`).
- Datenbank-Migration muss angewendet werden (`npx prisma migrate deploy`).
- Datenbank-Migration muss manuell angewendet werden (`prisma migrate deploy`)
- Scenario/Cause/Impact CRUD-Routen für eigenständiges Management noch nicht vorhanden (nur über Risk-Creation verknüpft)
# 2026-07-18 – Phase 4 Controls, SoA, Evidence und Dokumente

- Prisma-Schema um FrameworkVersion, Requirement, ControlRequirementMapping, ControlImplementation, ControlFinding, ControlAction, SoAItem, SoAApproval, EvidenceLink, DocumentAcknowledgement und DocumentReview erweitert.
- Migration [`migration.sql`](../backend/prisma/migrations/20260718190000_phase4_controls_soa_evidence_documents/migration.sql) für Phase-4-Tabellen und neue Felder angelegt.
- Services ergänzt: [`framework.service.ts`](../backend/src/services/framework.service.ts), [`evidence.service.ts`](../backend/src/services/evidence.service.ts), [`document.service.ts`](../backend/src/services/document.service.ts), erweiterter [`control.service.ts`](../backend/src/services/control.service.ts).
- REST-Routen ergänzt: [`framework.routes.ts`](../backend/src/routes/framework.routes.ts), [`evidence.routes.ts`](../backend/src/routes/evidence.routes.ts), [`document.routes.ts`](../backend/src/routes/document.routes.ts), erweiterte [`control.routes.ts`](../backend/src/routes/control.routes.ts).
- Shared Types und DTOs für Phase 4 erweitert; OpenAPI-Grundgerüst für Hauptendpunkte aktualisiert.
- Tests ergänzt in [`phase4.service.test.ts`](../backend/src/__tests__/phase4.service.test.ts). Ausgeführt: `npx jest src/__tests__/phase4.service.test.ts --runInBand` erfolgreich.
- Prisma validiert/generiert: `npx prisma validate` mit gesetzter Dummy-`DATABASE_URL`, `npx prisma generate` erfolgreich.
- Bekannte Altprobleme bleiben bestehen: globaler Backend-`tsc --noEmit` scheitert weiterhin in Altbereichen wie AuditLog-Routen, Contract/License-Relationen und RiskMethod-Service; neue Phase-4-bezogene Fehler wurden bereinigt.
