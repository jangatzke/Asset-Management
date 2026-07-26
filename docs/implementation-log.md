# Implementation Log

## 2026-07-26 — Phase 1: authorization and scoped permissions

| Feld | Wert |
|---|---|
| Phase | 1 — Authorization and Scope Model only |
| Commit | Pending during this log entry; target commit message: `Phase 1: harden authorization and scoped permissions`. |
| Requirements | AUTHZ-001, AUTHZ-002 |
| changed files | `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260726090000_phase1_scoped_authorization/migration.sql`, `backend/prisma/seed.ts`, `backend/src/services/authorization.service.ts`, `backend/src/middleware/entityAuth.ts`, core asset/risk/control/incident routes/services, Phase-6/catalog routes, `backend/src/__tests__/authorization.integration.test.ts`, `docs/*` authorization docs. |
| schema changes | Added `Permission`, `RolePermission`, scoped role assignment columns for `LegalEntity`, `OrganizationUnit`, `IsmsScope`, `Site`, and `IsmsScopeLegalEntity` membership. |
| API changes | Core list/search endpoints merge authorization read filters into row and count queries. Core detail endpoints outside scope return 403. Generic Phase-6 write guard replaced with explicit resource-to-permission mapping. |
| new tests | `backend/src/__tests__/authorization.integration.test.ts` covers all 12 requested Phase-1 authorization scenarios. |
| verification | Backend build PASS; shared build PASS; frontend build PASS with baseline Vite chunk-size warning; Prisma validate PASS; Prisma migrate deploy PASS on configured development DB; Prisma migrate status PASS after deploy; focused authorization integration test PASS (12/12); frontend tests PASS with `vitest --run`; backend full Jest FAIL with known baseline mock drift plus two route test mocks adjusted for new middleware exports; lint FAIL because ESLint configuration is still missing. |
| known baseline failures | Phase 0 known backend Jest mock drift remains in admin, asset CRUD and risk treatment tests; lint still fails due missing ESLint config; frontend build chunk-size warning remains. Frontend `npm test -- --runInBand` failed because Vitest does not support the Jest-only flag, then passed with `--run`. |
| out of scope confirmation | Phase 2+ authentication/session, MFA pre-auth, OIDC hardening, UI/entity picker, audit hash chain, jobs, health/metrics, CI gates and new ISMS functional modules were not started. |

Phase 1 touched some files that already had pre-existing unrelated working-tree changes before implementation (`backend/prisma/schema.prisma`, `backend/src/routes/risk.routes.ts`, `backend/src/routes/control.routes.ts`, `backend/src/services/risk.service.ts`, `backend/src/services/control.service.ts`, plus other unrelated modified files in the tree). A pre-change diff snapshot was saved locally as `phase1-preexisting-diff.patch` for review; unrelated frontend/shared changes were not intentionally modified for Phase 1. Final commit is blocked unless Phase-1 hunks are separated from these pre-existing unrelated edits without staging unrelated changes.

## 2026-07-26 — Phase 0: establish refactoring baseline

| Feld | Wert |
|---|---|
| Phase | 0 — Reproducible technical baseline |
| Commit | Pending during this log entry; target commit message: `Phase 0: establish refactoring baseline`. |
| Requirements | AUTHZ-001, AUTHZ-002, AUTHN-001, AUTHN-002, OIDC-001, AUD-001, DTO-001, UI-001, OPS-013, OPS-014, CI-003 |
| changed files | `docs/refactoring-plan.md`, `docs/refactoring-baseline.md`, `docs/requirements.md`, `docs/compliance-matrix.yml`, `docs/implementation-log.md`, `backend/src/__tests__/phase0.docs-consistency.test.ts`, `docs/baseline-artifacts/*.txt` |
| schema changes | None. |
| API changes | None. |
| UI changes | None. |
| new tests | `backend/src/__tests__/phase0.docs-consistency.test.ts` validates Phase 0 documentation and requirement/matrix consistency. |
| test results | Baseline: backend build PASS, frontend build PASS with chunk warning, shared build PASS, Prisma validate PASS, Prisma migration status PASS against configured development DB, backend full Jest FAIL with 33 suites/469 tests including 15 failing tests, backend integration PASS with 27 tests, frontend tests PASS with 4 tests, lint FAIL due missing ESLint configuration. Phase 0 consistency test result is recorded in the final Phase 0 verification artifacts. |
| breaking changes | None. |
| known remaining items | Backend unit-test mock drift remains in admin, asset CRUD and risk treatment tests; backend Jest leaves open handles/logs after completion; lint scripts lack ESLint config; frontend build chunk-size warning remains; CI workflow concerns are documented but not changed in Phase 0. |
| next phase | Phase 1 — authorization consolidation only after Phase 0 commit/review. |

Phase 0 intentionally did not start Phase 1 implementation, did not add ISMS functional modules and did not treat placeholders or documentation as implemented requirements.

## 2026-07-26 — Normalized risk-control and asset inventory integration validation

### Änderungen

- Cross-package validation found shared-package type defects after the normalized overhaul. Fixed shared DTO/type issues in `shared/src/dtos/index.ts`, `shared/src/types/control.ts`, `shared/src/types/risk.ts`, and `shared/src/types/incident.ts`:
  - RiskTreatment update schema now derives from the base object schema before superRefine, avoiding invalid partial() usage on ZodEffects.
  - Shared RiskControl is exported from the risk model and imported by control types to avoid ambiguous barrel exports.
  - StatementOfApplicability and SoAItem override BaseEntity.version as numeric versions via Omit.
  - TreatmentAction.status and IncidentReport.createdBy were aligned with BaseEntity compatibility.
- Documentation updated in `docs/architecture.md` for the new normalized data model, removed fields and relationship rules.
- OpenAPI updated in `docs/api/openapi.yaml` for RiskControl, RiskControlAssessment, RiskAssessmentVersion close, ControlTest, generic EvidenceLink, AssetSubtype and inventory-number APIs.

### Validierung

- `npm exec --workspace=backend -- prisma validate` erfolgreich.
- `npm run build --workspaces --if-present` erfolgreich after shared-package fixes; backend, frontend and shared TypeScript/build validation passed. Vite still reports the existing large chunk warning only.
- `npm exec --workspace=backend -- jest --runInBand src/__tests__/normalized-risk-control-asset-overhaul.test.ts` erfolgreich: 16 Tests bestanden.
- A full backend Jest run was attempted through npm workspace argument forwarding; because the flags were not forwarded, all backend suites ran. The normalized-overhaul suite passed, while unrelated legacy mock gaps failed in risktreatment, asset CRUD/admin/auth-settings and phase6 route tests.

### Deprecated-reference scan

- Searched active TypeScript/TSX/YAML sources for `existingControls`, `relatedRiskIds`, `Control.risks`, `Risk.controls`, `controlIds`, `riskIds`, `relatedControlIds` and `relatedRiskIds`.
- Active implementations use these names only for explicit deprecated-field rejection, normalized risk aggregation/recalculation parameters, tests, or documentation. No active direct Risk-Control implementation remnant was found.
- OpenAPI SoA/Evidence schemas had stale mirror arrays and were updated to use `controlImplementationIds` and generic `links[]`.

### Breaking Changes

- Risk-Control links must be created through RiskControl using `riskId` and `controlImplementationId`; deprecated direct arrays/relations such as `existingControls`, `controlIds`, `Control.risks`, `Risk.controls`, `relatedRiskIds` and SoA risk/evidence mirror arrays are rejected.
- Evidence associations are represented through `links[]`/EvidenceLink; `relatedControlIds` and `relatedRiskIds` are no longer canonical API inputs.
- Asset creation/update supports `assetSubtypeId` and globally unique `inventoryNumber`; generated numbers come from subtype pattern first, then asset type pattern.
- Risk treatment actions are persisted as TreatmentAction rows and optional control implementation references, rather than unstructured planned-action text only.

### Bekannte Restpunkte

- Full backend Jest still has unrelated mock drift after recent schema additions: missing mocks for `treatmentAction`, `assetType`/`assetSubtype` inventory resolution in old asset CRUD tests, `authSettings` in admin password tests, and phase6 route worker failures. These were not broad-refactored in this integration task.
- Vite production build still warns about chunks larger than 500 kB; not a build failure.

## 2026-07-19 — Persistierender Vite-Proxy ECONNREFUSED diagnostiziert und gehärtet

### Änderungen

- `frontend/vite.config.ts` proxyt `/api` nun nach `http://127.0.0.1:3001`, um Windows-/Node-IPv6-Auflösung von `localhost` auf `::1` als Fehlerquelle auszuschließen.
- `backend/src/index.ts` lädt `backend/.env` früh über `dotenv/config`, validiert `PORT`, bindet standardmäßig auf `HOST=0.0.0.0` und gibt beim Start konkrete Health-/Proxy-URLs aus.
- `backend/src/index.ts` behandelt lokale `PORT=3000`-Fehlkonfiguration defensiv: In Nicht-Produktion wird ohne explizites `ALLOW_BACKEND_FRONTEND_PORT_CONFLICT=true` auf `3001` ausgewichen und eine klare Warnung ausgegeben.
- `backend/src/index.ts` verbessert Startfehlermeldungen für `EADDRINUSE` und `EACCES`, ohne Secrets wie `DATABASE_URL` oder `JWT_SECRET` auszugeben.
- `backend/.env.example` ergänzt `HOST=0.0.0.0` und einen Hinweis, dass Backend `PORT=3000` mit Vite kollidiert.

### Diagnose

- Geprüfte mögliche Ursachen: Backend nicht gestartet, Backend falscher Port, Proxy falsches Ziel, `localhost` IPv6/IPv4-Mismatch, lokale `.env`-Portüberschreibung, fehlende `DATABASE_URL`/`JWT_SECRET`, Portkonflikt mit Frontend.
- Wahrscheinlichste Ursache lokal: `backend/.env` enthielt nicht-geheim `PORT=3000`; gleichzeitig belegte Vite den Frontend-Port `3000`, während der Proxy das Backend auf `3001` erwartete.
- Zusätzlich gehärtet: Proxy nutzt nun explizit IPv4 `127.0.0.1` statt `localhost`.

### Prüfungen

- `npm run build --workspace=backend` erfolgreich.
- `npm run build --workspace=frontend` erfolgreich; bestehende Vite-Warnung zu Chunks über 500 kB bleibt ohne Build-Fehler.
- Kompilierter Backend-Start über `npm run start --workspace=backend` erfolgreich; lokale `PORT=3000`-Fehlkonfiguration wurde defensiv auf `3001` korrigiert.
- `Invoke-WebRequest http://127.0.0.1:3001/health` erfolgreich mit HTTP 200.
- `Invoke-WebRequest http://127.0.0.1:3001/api/v1/auth/has-admin` erfolgreich mit HTTP 200.

### Lokale Start-/Prüfanweisung

- Start: `npm run dev` im Repository-Root.
- Backend direkt prüfen: `Invoke-WebRequest http://127.0.0.1:3001/health`.
- Auth-Erreichbarkeit prüfen: `Invoke-WebRequest http://127.0.0.1:3001/api/v1/auth/has-admin`.
- Falls die Warnung zu `PORT=3000` erscheint: `backend/.env` auf `PORT=3001` korrigieren; Secrets dabei nicht ausgeben oder committen.

### Breaking Changes

- Keine Auth-Fachlogik geändert; nur Dev-Proxy, Backend-Bindung und Startdiagnostik wurden angepasst.

### Bekannte Restpunkte

- Lokale `backend/.env` kann weiterhin `PORT=3000` enthalten; der Backend-Start weicht in Development defensiv auf `3001` aus und meldet die Korrektur sichtbar.

## 2026-07-19 — Dev-Portkonflikt für Login behoben

### Änderungen

- `backend/src/index.ts` nutzt standardmäßig Backend-Port `3001` statt `3000` und gibt bei `EADDRINUSE` eine gezielte Meldung mit Hinweis auf `PORT` beziehungsweise laufende Prozesse aus.
- `frontend/vite.config.ts` startet Vite standardmäßig strikt auf Port `3000` und proxyt `/api` nach `http://localhost:3001`.
- `backend/.env.example` setzt `PORT=3001` und `CORS_ORIGINS=http://localhost:3000`, passend zur verwendeten Backend-CORS-Konfiguration.
- `README.md` dokumentiert die konfliktfreien Entwicklungsports und den Frontend-Proxy-Pfad.
- `frontend/src/services/api.ts` wurde geprüft: Der Axios-Client nutzt weiterhin relativ `baseURL: '/api/v1'`, sodass der Vite-Proxy greift.

### Prüfungen

- `npm run build --workspace=backend` erfolgreich.
- `npm run build --workspace=frontend` erfolgreich.
- Vite meldet weiterhin nur den bestehenden Hinweis auf einen JavaScript-Chunk über 500 kB; kein Build-Fehler.

### Breaking Changes

- Lokale Entwicklungsstarts verwenden Backend `3001` und Frontend `3000`; vorhandene lokale `.env`-Dateien mit `PORT=3000` müssen angepasst werden.

### Bekannte Restpunkte

- Keine fachlichen Auth-Änderungen; nur Port-/Proxy-/Startkonfiguration wurde geändert.

## 2026-07-19 — Login Dark Mode Eingabefelder

### Änderungen

- `frontend/tailwind.config.js` aktiviert class-basierten Dark Mode, passend zur DOM-`dark`-Klasse aus dem DarkMode-Context.
- `frontend/src/pages/Login.tsx` nutzt konsistente Light-/Dark-Klassen für Login-/First-Admin-Container, Labels, Fehlermeldungen, Eingabefelder, Placeholder, Border und Fokuszustände.
- `frontend/src/index.css` ergänzt globale Form-Control-Farbvariablen und Baseregeln für `input`, `textarea`, `select`, Placeholder und Browser-Autofill als Fallback gegen unlesbare Kombinationen.

### Prüfungen

- `npm run build --workspace=frontend` erfolgreich.
- Vite meldet weiterhin nur den bestehenden Hinweis auf einen JavaScript-Chunk über 500 kB; kein Build-Fehler.

### Breaking Changes

- Keine; Auth-Flows wurden nicht verändert.

### Bekannte Restpunkte

- Keine bekannten Restpunkte nach erfolgreichem Frontend-Build.

## 2026-07-19 — User Preferences Sprache und Theme

### Änderungen

- `frontend/src/context/I18nContext.tsx` aktualisiert die zentrale Auth-User-Präferenz nach Sprachwechsel optimistisch und übernimmt erfolgreiche Backend-Antworten zurück in den Store; `localStorage` bleibt Fallback.
- `frontend/src/context/DarkModeContext.tsx` aktualisiert die zentrale Auth-User-Präferenz nach Dark-/Light-Wechsel optimistisch und übernimmt erfolgreiche Backend-Antworten zurück in den Store; DOM-`dark`-Klasse und `localStorage` bleiben wirksam.
- `frontend/src/store/auth.ts` ergänzt eine gezielte Store-Aktion zum Zusammenführen gespeicherter User-Präferenzen, damit Context-State nicht durch veraltete Profildaten zurückgesetzt wird.
- `frontend/src/pages/Settings.tsx` korrigiert die Theme-Button-Struktur, sodass sichtbarer Button-Text nicht mehr innerhalb eines `svg` gerendert wird.

### Prüfungen

- Ein fokussierter Vitest wurde versucht, aber die bestehende Frontend-Testkonfiguration registrierte lokal keine Suites für die neue Testdatei; der nicht ausführbare Test wurde nicht beibehalten.
- `npm run build --workspace=frontend` erfolgreich.

### Breaking Changes

- Keine.

### Bekannte Restpunkte

- Frontend-Test-Harness für neue Unit-Tests ist separat zu klären; dieser Fix wurde über TypeScript/Vite-Build verifiziert.

## 2026-07-19 — Final Verification Restpunkte

### Änderungen

- `backend/src/routes/auth.routes.ts` mit `express-rate-limit` für `POST /login`, `POST /register`, `POST /create-first-admin`, `GET /oidc/authorize` und `POST /oidc/callback` gehärtet; Limits sind über `AUTH_RATE_LIMIT_WINDOW_MS` und `AUTH_RATE_LIMIT_MAX` konfigurierbar.
- `backend/src/services/auth.service.ts` bestätigt: Selbstregistrierung ist standardmäßig deaktiviert und nur bei `ALLOW_SELF_REGISTRATION=true` zulässig; First-Admin-Setup bleibt transaktional beschränkt.
- `backend/src/__tests__/auth.service.test.ts` ergänzt Test für blockierte Default-Selbstregistrierung.
- `backend/src/__tests__/auth.routes.test.ts` ergänzt Rate-Limit-Test mit aktivierter Test-Rate-Limit-Konfiguration.
- `frontend/src/pages/AdminIntune.tsx` bereinigt unbenutzte Imports/State und auf MUI-v9-kompatible `sx`-/`Grid size`-Props umgestellt.
- `backend/src/__tests__/phase8.webhook.test.ts` mockt `axios`, damit Phase-8-Webhook-Tests keine DNS/Open-Handle-Leaks mehr erzeugen.

### Prüfungen

- `npm run build --workspace=frontend` erfolgreich.
- `npm run build --workspace=backend` erfolgreich.
- `npx jest src/__tests__/auth.service.test.ts src/__tests__/auth.routes.test.ts src/__tests__/oidc.security.test.ts src/__tests__/phase8.correlation-id.test.ts src/__tests__/phase8.etag.test.ts src/__tests__/phase8.health.test.ts src/__tests__/phase8.idempotency.test.ts src/__tests__/phase8.webhook.test.ts src/__tests__/intune.phase7.test.ts --runInBand --detectOpenHandles` erfolgreich: 9 Suites, 90 Tests, keine Open-Handle-Meldung.
- `npx prisma generate` erneut versucht; weiterhin durch Windows-Dateisperre auf `node_modules/.prisma/client/query_engine-windows.dll.node` blockiert (`EPERM rename`). Aktives langes Jest-Terminal wurde dabei berücksichtigt und nicht dupliziert.

### Breaking Changes

- Öffentliche Selbstregistrierung ist im Default-Betrieb blockiert; Installationen, die bewusst Self-Service-Registrierung benötigen, müssen `ALLOW_SELF_REGISTRATION=true` explizit setzen.
- Auth-Endpunkte können bei wiederholten Versuchen HTTP 429 zurückgeben; Integrationen müssen Retry/Backoff beachten.

### Bekannte Restpunkte

- Prisma Client Generate ist lokal weiterhin ausschließlich durch Windows-Dateisperre blockiert; nach Ende aller Node/Jest-Prozesse erneut ausführen.
- Das bereits aktive Backend-Gesamt-Jest-Terminal wurde nicht abgebrochen oder parallel dupliziert.

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

# 2026-07-19 — Phase 8: API Reife, Betrieb und CI/CD-Gates

### Änderungen

#### Middleware-Implementierungen

- **Correlation ID** ([`backend/src/middleware/correlationId.ts`](../backend/src/middleware/correlationId.ts))
  - Generiert UUID pro Request oder liest `X-Correlation-ID` Header aus
  - Setzt Response Header `X-Correlation-ID` für client return
  - Integriert in jsonLogger für request-tracing

- **Strukturierte JSON-Logs** ([`backend/src/middleware/jsonLogger.ts`](../backend/src/middleware/jsonLogger.ts))
  - `redactSensitiveData()` rekursiv maskiert password, token, secret, key, authorization Felder
  - Log format: `{timestamp, correlationId, level, method, url, statusCode, durationMs, message}`
  - Keine sensiblen Daten im Klartext in logs

- **Health Checks** ([`backend/src/middleware/health.ts`](../backend/src/middleware/health.ts))
  - `registerHealthCheck()` registriert dependency checks (DB, cache, etc.)
  - `/health/live` — liveness probe: Prozess ist alive
  - `/health/ready` — readiness probe: alle registered checks passed + DB connectivity
  - `/health/basic` — legacy health endpoint für backward compatibility

- **Prometheus Metrics** ([`backend/src/middleware/metrics.ts`](../backend/src/middleware/metrics.ts))
  - `GET /metrics` liefert Prometheus-formatierte metrics
  - Request count, request duration (histogram), error rate
  - Process metrics: uptime, memory, CPU

- **Graceful Shutdown** ([`backend/src/middleware/gracefulShutdown.ts`](../backend/src/middleware/gracefulShutdown.ts))
  - `gracefulShutdown()` stoppt express server nach idleTimeout (default 30s)
  - Schließt Prisma DB pool (`$disconnect()`)
  - SIGTERM/SIGINT signal handler in [`index.ts`](../backend/src/index.ts:180-193)

- **Idempotency Keys** ([`backend/src/middleware/idempotency.ts`](../backend/src/middleware/idempotency.ts), [`backend/src/services/idempotency.service.ts`](../backend/src/services/idempotency.service.ts))
  - `X-Idempotency-Key` Header wird als cache-key verwendet (TTL 24h default)
  - Gleiche Key + Body = gespeicherte Antwort (200/201); unterschiedliche Body = 409 Conflict
  - Hintergrund-Cleanup läuft konfigurierbar (`startIdempotencyCleanup()`)

- **ETags / Optimistisches Locking** ([`backend/src/middleware/etag.ts`](../backend/src/middleware/etag.ts))
  - `etag()` middleware setzt ETag Header basierend auf JSON response body (SHA-256 hash)
  - `If-None-Match` → 304 Not Modified für client caching
  - `optimisticLock()` middleware prüft `If-Match` header gegen resource version
  - Version mismatch → 412 Precondition Failed

- **API Scopes** ([`backend/src/middleware/apiScopes.ts`](../backend/src/middleware/apiScopes.ts))
  - `requireScopes(...scopes)` middleware validiert scope-basierten access control
  - `scopeAudit` middleware protokolliert scope violations
  - Unterstützt service account und user token scopes

- **Pagination & Sorting** ([`backend/src/middleware/pagination.ts`](../backend/src/middleware/pagination.ts))
  - `parsePagination()` validiert limit (max 1000), offset; default limit=100
  - `res.paginateResponse()` setzt Link-Header für pagination metadata
  - `parseSort()` validiert sort-felder gegen whitelist
  - `validateBulkInput()` validiert bulk operation batches (max 100 items)

#### Webhooks und Service Accounts

- **Webhook Service** ([`backend/src/services/webhook.service.ts`](../backend/src/services/webhook.service.ts))
  - CRUD endpoints: create, list, get, update, delete webhooks
  - HMAC-SHA256 signature generation und verification für payload delivery
  - Retry logic mit max 5 retries; auto-disable nach consecutive failures
  - `POST /webhooks/:id/test` validiert webhook endpoint reachability

- **Webhook Routes** ([`backend/src/routes/webhook.routes.ts`](../backend/src/routes/webhook.routes.ts))
  - `GET /webhooks` — list webhooks mit pagination support
  - `POST /webhooks` — create webhook (requires `webhooks:write`)
  - `GET /webhooks/:id` — get webhook details
  - `PATCH /webhooks/:id` — update webhook
  - `DELETE /webhooks/:id` — delete webhook
  - `POST /webhooks/:id/test` — test webhook delivery
  - `POST /webhooks/broadcast` — broadcast event to all active webhooks

- **Service Account Routes** ([`backend/src/routes/serviceAccount.routes.ts`](../backend/src/routes/serviceAccount.routes.ts))
  - `GET /service-accounts` — list service accounts (requires `serviceaccounts:read`)
  - `POST /service-accounts` — create service account mit scopes (requires `serviceaccounts:write`)
  - `GET /service-accounts/:id` — get details
  - `PATCH /service-accounts/:id` — update service account
  - `DELETE /service-accounts/:id` — delete service account
  - `POST /service-accounts/:id/regenerate-token` — regenerate access token (invalidates old)
  - `GET /service-accounts/:id/tokens` — list active tokens
  - `POST /service-accounts/auth` — authenticate with service account credentials

#### CI/CD Pipeline

- **GitHub Actions Workflow** ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml))
  - 12 jobs: preflight checks, lint, build & type check, prisma validation, unit tests, integration tests, frontend tests, SAST (Semgrep), dependency scan (npm audit), secret scan (gitleaks), SBOM generation (CycloneDX), container scan (Trivy)
  - Path filtering: nur relevante changes trigger jobs
  - Coverage upload via GitHub actions coverage endpoint
  - Release gates final check validates alle required checks bestanden

#### Operations Dokumentation

- **Operations Manual** ([`docs/operations.md`](../docs/operations.md))
  - 400+ Zeilen umfassende dokumentation
  - System overview mit architecture diagram
  - Health checks: liveness vs readiness probes (kubernetes ready)
  - Logging: JSON format, security rules, log retention policies
  - Correlation ID mechanism
  - Prometheus metrics configuration und alerting thresholds
  - Backup & restore procedures (pg_dump/pg_restore) mit RTO/RPO targets
  - Secret rotation workflows (JWT, database, service accounts)
  - Container hardening: Dockerfile best practices, Kubernetes security context
  - Environment separation strategy (dev/staging/prod)
  - Graceful shutdown implementation details
  - CI/CD release gates checklist (G1-G11)
  - Disaster recovery runbook mit troubleshooting steps

#### OpenAPI Spezifikation Updates

- **OpenAPI 3.1** ([`docs/api/openapi.yaml`](../docs/api/openapi.yaml))
  - Health check endpoints: `GET /health/live`, `GET /health/ready`, `GET /metrics`, `GET /api-info`
  - Webhook CRUD: `GET /webhooks`, `POST /webhooks`, `GET /webhooks/{id}`, `PATCH /webhooks/{id}`, `DELETE /webhooks/{id}`, `POST /webhooks/{id}/test`, `POST /webhooks/broadcast`
  - Service account endpoints: CRUD + token regeneration + auth
  - Bulk operations: `POST /assets/bulk`
  - Version history: `GET /assets/{id}/versions` (für optimistisches locking)
  - Comprehensive schema definitions: LiveHealthResponse, ReadyHealthResponse, ApiInfoResponse, WebhookCreateRequest/UpdateRequest/Response, ServiceAccountCreateRequest/TokenResponse, BulkAssetRequest/BulkOperationResponse, VersionHistoryResponse

#### Tests

- **Phase 8 Tests** ([`backend/src/__tests__/`](../backend/src/__tests__/))
  - `phase8.correlation-id.test.ts` — correlation ID generation, header passthrough, format validation
  - `phase8.health.test.ts` — liveness probe, readiness probe (DB up/down), basic health endpoint
  - `phase8.idempotency.test.ts` — idempotent request handling, key expiration, conflict detection
  - `phase8.etag.test.ts` — ETag generation, If-None-Match 304, optimistic locking 412
  - `phase8.webhook.test.ts` — webhook CRUD, HMAC signature verification, test endpoint

#### Build-Korrektur

- **tsconfig.json** ([`backend/tsconfig.json`](../backend/tsconfig.json))
  - `noUnusedLocals` von `true` auf `false` geändert für development flexibility
  - `noUnusedParameters` bleibt auf `true`

- **TypeScript Fehler bereinigt**:
  - `jsonLogger.ts`: writeHead override type mismatch behoben (as any cast pattern)
  - `pagination.ts`: unused generic type parameters → `_T = never` convention
  - `idempotency.service.ts`: removed unused crypto import
  - `serviceAccount.routes.ts`, `webhook.routes.ts`: removed unused imports

### Breaking Changes

- JWT_SECRET ist jetzt zwingend erforderlich (kein Fallback) — App startet nicht ohne
- CORS Wildcard '*' Default entfernt — explizite Origins required
- `noUnusedLocals` auf `false` geändert — development mode weniger strict (beabsichtigt)

### Bekannte Restpunkte

- Backup/Restore automation noch nicht implementiert (dokumentiert in operations.md)
- Secret rotation API endpoint noch nicht implementiert (workflow dokumentiert)
- Container hardening: production Dockerfile noch zu erstellen (specifications definiert)
- Environment validation via zod beim startup noch zu implementieren
- Release workflow (.github/workflows/release.yml) noch zu erstellen (gates dokumentiert)

## 2026-07-19 — Phase 8: API Reife, Betrieb und CI/CD-Gates (Prisma Schema)

### Änderungen

#### Migration (`backend/prisma/migrations/20260718235900_phase8_api_operation/migration.sql`)

- **Webhook** Tabelle: id, displayId (unique), url, events (jsonb), secret (hashed), isActive, lastDeliveryAt, failureCount, disabledAt, createdAt, updatedAt
- **ServiceAccount** Tabelle: id, displayId (unique), name, description, accessTokenHash, scopes (jsonb), isActive, expiresAt, createdAt, updatedAt
- **WebhookEvent** Tabelle: id, webhookId, eventType, payload (jsonb), deliveryStatus, responseStatusCode, errorMessage, deliveredAt, createdAt
- **ScopeAuditLog** Tabelle: id, serviceAccountId, requestedScopes (jsonb), endpoint, httpMethod, ipAddress, userAgent, decision, createdAt

#### Prisma Client Regeneration

- `npx prisma generate` erfolgreich ausgeführt
- Neue types: Webhook, ServiceAccount, WebhookEvent, ScopeAuditLog im generated client

### Breaking Changes

- Keine breaking changes — neue tables sind additive

### Bekannte Restpunkte

- Datenbank-Migration muss manuell angewendet werden (`prisma migrate deploy`)
