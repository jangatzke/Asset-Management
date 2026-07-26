# Repository Assessment – Asset Management / ISMS

**Assessment-Scope:** Analyse und Dokumentation ohne Produktionscode-Änderungen.  
**Stand:** 2026-07-25  
**Startpunkte:** [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma), [`backend/src`](../backend/src), [`frontend/src`](../frontend/src), [`docs/compliance-matrix.md`](compliance-matrix.md), [`docs/security-model.md`](security-model.md), [`docs/architecture.md`](architecture.md), [`docs/requirements.md`](requirements.md), [`docs/api/openapi.yaml`](api/openapi.yaml)

---

## Executive Summary

Die Anwendung bildet viele Bausteine eines ISO-27001-nahen Asset-Management- und ISMS-Systems bereits strukturell ab: Asset-Inventar, Asset-Beziehungen, Schutzbedarfe, Risiken, Controls, Statement of Applicability, Evidences, Policies, Incidents, NIS2, Audit/Management-Review, Training, CAPA, BIA/BCP, Lieferantenmanagement, Workflows, Reports und Auditlogs sind im Datenmodell vorhanden.

Die wichtigsten Risiken liegen nicht im Fehlen aller Grundmodule, sondern in Inkonsistenzen zwischen Datenmodell, API und UI, in nicht vollständig durchgesetzter referenzieller Integrität bei Verantwortlichenfeldern, in UX-Brüchen durch manuelle UUID-Felder sowie in Altlasten der Bezeichnung `phase6`. Außerdem enthält der Security-Layer gute Ansätze, aber noch relevante Lücken: Legacy-Role-Checks, Default-Allow-Verhalten bei fehlenden Entity Permissions, sensible Debug-Logs, Token-Ablage im Browser-LocalStorage und unvollständige Security-Testabdeckung.

---

## Prioritäten

| Priorität | Bedeutung |
|---|---|
| P0 | Security-, Compliance- oder Datenintegritätsrisiko mit hoher Umsetzungspriorität |
| P1 | Funktionale/UX-Lücke, die Alltagstauglichkeit oder Auditierbarkeit deutlich beeinträchtigt |
| P2 | Cleanup, Konsistenz, Dokumentation, Best-Practice-Verbesserung |

---

## Geprüfte Bereiche

| Bereich | Ergebnis |
|---|---|
| Datenmodell | Sehr breit, aber Verantwortlichen-/Owner-Felder häufig als freie `String`-IDs ohne Relation zu [`User`](../backend/prisma/schema.prisma:14) modelliert. |
| API-Routen | Viele Kernrouten vorhanden; Read-Operationen oft nur authentifiziert, Write-Operationen teils Entity-Auth, teils Legacy-Admin-Check. |
| Services | Domänenlogik vorhanden; generische ISMS-Operations-Services stark konfigurationsgetrieben. |
| UI-Masken | Assets/Risks nutzen Suchkomponente, mehrere ISMS-/Prozess-/Incident-Masken verlangen weiterhin manuelle IDs oder Platzhalter. |
| Navigation | `isms-operations` ist Ziel, `isms-phase6` existiert als Redirect; interne API/Dateinamen bleiben bei `phase6`. |
| Documentation | Architektur/Security/Compliance-Dokumente existieren, sind teilweise veraltet gegenüber Code-Iststand. |
| Context7 | Express-, Prisma- und React-Best-Practices geprüft und in Findings eingearbeitet. |

---

## Findings

### F-01 – P0 – Owner-/Verantwortlichenfelder ohne referenzielle Integrität

**Beobachtung:** Viele zentrale Verantwortlichenfelder sind als `String` gespeichert, aber nicht per Prisma-Relation an [`User`](../backend/prisma/schema.prisma:14) gebunden. Beispiele: Asset-Verantwortliche in [`Asset`](../backend/prisma/schema.prisma:291), ISMS-Scope-Verantwortlicher in [`IsmsScope`](../backend/prisma/schema.prisma:208), Risiko-Owner in [`Risk`](../backend/prisma/schema.prisma:609), Control-Verantwortliche in [`Control`](../backend/prisma/schema.prisma:1072), Policy-/Document-Owner in [`PolicyDocument`](../backend/prisma/schema.prisma:1557), BIA/BCP/Audit/Training/Metric/Report Owner in den ISMS-Modellen ab [`BusinessImpactAnalysis`](../backend/prisma/schema.prisma:1729).

**Risiko:** Ungültige oder gelöschte User-IDs können gespeichert werden. ISO-27001-Auditierbarkeit, Verantwortlichkeitsnachweise und Reminder-Zustellung sind dadurch nicht belastbar.

**Empfehlung:** Owner-/Assignee-/Reviewer-/Approver-Felder als echte Prisma-Relationen zu [`User`](../backend/prisma/schema.prisma:14) modellieren, referenzielle Aktionen bewusst setzen, relevante Foreign-Key-Felder indexieren und API-Validierung gegen aktive Benutzer ergänzen.

---

### F-02 – P0 – Manuelle UUID-Eingabe in ISMS-Operations-Masken

**Beobachtung:** Die generische ISMS-Maske verlangt weiterhin manuelle UUIDs, z. B. `Owner ID (User ID)` und `UUID of the owner` in [`frontend/src/pages/ISMSPhase6.tsx`](../frontend/src/pages/ISMSPhase6.tsx:91), Trainings-Zuweisungen mit `Course ID` und `User ID (Assignee)` in [`frontend/src/pages/ISMSPhase6.tsx`](../frontend/src/pages/ISMSPhase6.tsx:216), sowie weitere Owner-Felder in [`frontend/src/pages/ISMSPhase6.tsx`](../frontend/src/pages/ISMSPhase6.tsx:272).

**Risiko:** Nicht alltagstauglich; Nutzer müssen IDs kennen oder kopieren. Hohe Fehlerrate, geringe Akzeptanz, inkonsistente Verantwortlichkeiten.

**Empfehlung:** Alle User-/Owner-/Assignee-/Reviewer-/Approver-Felder auf eine einheitliche Such-/Select-Komponente umstellen. Bestehende Komponente [`EntitySearchSelect`](../frontend/src/components/EntitySearchSelect.tsx:28) kann dafür als Basis dienen, sollte aber API-seitig `/users/owners` verwenden statt Admin-User-Listen.

---

### F-03 – P1 – Owner-Suche ist uneinheitlich und teilweise fachlich falsch verdrahtet

**Beobachtung:** Assets und Risiken nutzen Suchfelder, greifen aber über [`adminApi.listUsers`](../frontend/src/services/api.ts:151) auf Admin-Routen zu, z. B. in [`frontend/src/pages/Assets.tsx`](../frontend/src/pages/Assets.tsx:156) und [`frontend/src/pages/Risks.tsx`](../frontend/src/pages/Risks.tsx:84). Zusätzlich nutzt [`frontend/src/pages/Assets.tsx`](../frontend/src/pages/Assets.tsx:469) für `Organization Unit` ebenfalls die User-Suche.

**Risiko:** Nicht-Admins können Owner-Auswahl verlieren; fachlich falsche Auswahl für Organisationseinheiten; unnötige Abhängigkeit von Admin-Rechten.

**Empfehlung:** Dedizierte Such-APIs verwenden: [`userSearchApi.owners()`](../frontend/src/services/api.ts:95) für Owner-Felder, Organisationseinheiten über echte Org-Unit-Endpunkte statt User-Liste. Labels sollten Namen/E-Mail und optional Display-ID anzeigen, nie nur UUID.

---

### F-04 – P1 – Prozess- und Incident-Masken enthalten harte Platzhalter statt User-Auswahl

**Beobachtung:** Prozesse haben ein freies Textfeld `Process Owner` in [`frontend/src/pages/Processes.tsx`](../frontend/src/pages/Processes.tsx:269). Incidents setzen `incidentManagerId` und `authorId` auf `frontend-user` in [`frontend/src/pages/Incidents.tsx`](../frontend/src/pages/Incidents.tsx:66) und [`frontend/src/pages/Incidents.tsx`](../frontend/src/pages/Incidents.tsx:126).

**Risiko:** Verantwortlichkeiten sind nicht nachvollziehbar und nicht ISO-27001-/ISMS-tauglich. Platzhalter können produktive Daten kontaminieren.

**Empfehlung:** Prozess-Owner und Incident-Manager über User-Suche auswählen oder serverseitig aus dem angemeldeten Benutzer setzen; Platzhalterwerte entfernen und Validierung gegen aktive User erzwingen.

---

### F-05 – P0 – Legacy-Authorization bleibt in mehreren Routen aktiv

**Beobachtung:** Es existiert eine moderne [`requireAdminAccess`](../backend/src/middleware/entityAuth.ts:70), aber mehrere Routen definieren weiterhin `authorize('system_admin')`, z. B. [`asset.routes.ts`](../backend/src/routes/asset.routes.ts:81), [`contract.routes.ts`](../backend/src/routes/contract.routes.ts:5), [`businessprocess.routes.ts`](../backend/src/routes/businessprocess.routes.ts:5), [`riskmethod.routes.ts`](../backend/src/routes/riskmethod.routes.ts:5), [`import.routes.ts`](../backend/src/routes/import.routes.ts:7), [`auditLog.routes.ts`](../backend/src/routes/auditLog.routes.ts:9).

**Risiko:** Rollen mit `canAccessAdmin = true` funktionieren nicht konsistent; Gruppenrollen und dynamische Berechtigungen werden umgangen. Least-Privilege und Auditierbarkeit leiden.

**Empfehlung:** Alle Legacy-Admin-Checks auf [`requireAdminAccess`](../backend/src/middleware/entityAuth.ts:70) migrieren und Regressionstests für Direktrollen, Gruppenrollen, abgelaufene Rollen und Nicht-Admins ergänzen.

---

### F-06 – P0 – Entity Authorization hat Default-Allow-Verhalten

**Beobachtung:** [`AuthorizationService.checkEntityPermission()`](../backend/src/services/authorization.service.ts:171) erlaubt Zugriff, wenn keine Entity Permissions konfiguriert sind: `default allow` in [`authorization.service.ts`](../backend/src/services/authorization.service.ts:203).

**Risiko:** Fehlkonfiguration führt zu zu weitreichendem Zugriff. Das widerspricht Least Privilege und ISO-27001 Access-Control-Erwartungen.

**Empfehlung:** Für Produktivbetrieb Default-Deny erzwingen; Migrations-/Kompatibilitätsphase nur explizit per Feature-Flag erlauben. Tests für fehlende `entityPermissions` ergänzen.

---

### F-07 – P0 – Auth-Middleware enthält unsichere Debug-Logs und Secret-Fallback

**Beobachtung:** [`authenticate`](../backend/src/middleware/auth.ts:10) loggt Authorization Header und Token-Präfix in [`auth.ts`](../backend/src/middleware/auth.ts:14). Außerdem nutzt JWT-Verifikation weiterhin `process.env.JWT_SECRET || 'secret'` in [`auth.ts`](../backend/src/middleware/auth.ts:23).

**Risiko:** Token-Fragmente können in Logs landen; Secret-Fallback ermöglicht unsichere Deployments. Context7/Express-Best-Practices betonen Security Headers, HTTPS, Input-Validation und produktionssichere Konfiguration ohne unsichere Defaults.

**Empfehlung:** Token-/Header-Logs entfernen oder strikt redigieren, Start ohne starkes `JWT_SECRET` verweigern, `jwt.verify` mit expliziter Algorithmus-Whitelist und Tests härten.

---

### F-08 – P1 – Token-Ablage im Browser-LocalStorage

**Beobachtung:** Axios liest den Bearer Token aus `localStorage` in [`frontend/src/services/api.ts`](../frontend/src/services/api.ts:10).

**Risiko:** Bei XSS kann der Token exfiltriert werden. React schützt gerenderte Werte standardmäßig, aber Context7/React-Dokumentation warnt ausdrücklich vor XSS bei unsicherem HTML und untrusted input.

**Empfehlung:** Mittelfristig HttpOnly/SameSite/Secure Cookies oder Backend-for-Frontend-Session-Konzept prüfen. Kurzfristig CSP, keine unsicheren HTML-Sinks, kurze Token-Lifetime und Refresh-Rotation sicherstellen.

---

### F-09 – P1 – ISMS-/ISO27001-Abdeckung breit, aber operative Nachweise ungleichmäßig

**Beobachtung:** Datenmodell enthält Scope, Interested Parties, Framework/Requirements, Controls, SoA, Evidence, Auditlog, PolicyDocuments, CAPA, Management Review, Objectives/Metrics, Training, Supplier, BIA/BCP und NIS2. Einige Implementierungen sind generisch oder stark JSON-basiert, z. B. SoA-Felder mit ID-Arrays in [`SoAItem`](../backend/prisma/schema.prisma:1235) oder BIA/BCP/Audit-Felder mit `Json`-Sammlungen ab [`BusinessImpactAnalysis`](../backend/prisma/schema.prisma:1729).

**Risiko:** Für ISO-27001-Audits reichen Datenfelder allein nicht aus; Workflows, Freigaben, Reviews, Evidenz-Verknüpfungen, Verantwortlichkeiten und Änderungsnachweise müssen konsistent bedienbar und auswertbar sein.

**Empfehlung:** Compliance-Matrix gegen tatsächliche Routen/UI-Funktionen aktualisieren, Nachweisfähigkeit pro ISO-27001-Klausel/Annex-Control dokumentieren, JSON-Listen für zentrale Verknüpfungen schrittweise normalisieren.

---

### F-10 – P1 – `phase6`-Altlasten sind noch systemweit vorhanden

**Beobachtung:** Trotz UI-Route `isms-operations` bleiben Dateinamen, API-Pfade, Services, Tests, OpenAPI und Dokumentation bei `phase6`, u. a. [`backend/src/routes/phase6.routes.ts`](../backend/src/routes/phase6.routes.ts), [`backend/src/services/phase6.service.ts`](../backend/src/services/phase6.service.ts), [`frontend/src/services/api.ts`](../frontend/src/services/api.ts:280), [`docs/api/openapi.yaml`](api/openapi.yaml:14), [`README.md`](../README.md:345), Migration/Runtime-Dateien wie [`backend/prisma/phase6-runtime-alignment.sql`](../backend/prisma/phase6-runtime-alignment.sql:1).

**Risiko:** Fachliche Bezeichnung bleibt technisch und historisch geprägt; API wirkt nicht domänenorientiert. Cleanup-Aufwand steigt mit weiterer Nutzung.

**Empfehlung:** Entscheidung treffen: API-Kompatibilität erhalten, aber intern schrittweise auf `isms-operations`/`isms` umbenennen; alte `/phase6`-Routen als deprecated Alias dokumentieren; Dist-/Build-Artefakte nicht versionieren.

---

### F-11 – P1 – Dist-/Generated-Artefakte und Node-Module im Repository-Kontext

**Beobachtung:** Suche fand Treffer in [`backend/dist`](../backend/dist), [`frontend/dist`](../frontend/dist) und [`node_modules`](../node_modules). Diese Artefakte enthalten alte Benennungen und können Assessments verfälschen.

**Risiko:** Review-Rauschen, mögliche versehentliche Auslieferung veralteter Builds, unnötig große Diffs.

**Empfehlung:** Prüfen, ob Build-Artefakte und `node_modules` versioniert sind oder nur lokal existieren. Falls versioniert: aus Repository entfernen und `.gitignore`/CI-Build-Prozess sauberstellen.

---

### F-12 – P1 – OpenAPI ist sehr unvollständig

**Beobachtung:** [`docs/api/openapi.yaml`](api/openapi.yaml:13) dokumentiert sichtbar vor allem generische `phase6`-Endpunkte; viele zentrale Asset-, Risk-, Control-, Incident-, User- und Admin-Endpunkte sind nicht als vollständige Source of Truth abgebildet.

**Risiko:** API-Nutzung, Security Reviews und Audit-Nachweise werden erschwert. Contract-Tests sind schwer ableitbar.

**Empfehlung:** OpenAPI auf alle produktiven Endpunkte erweitern, Security Schemes, Request-/Response-Schemas, Error-Format, Pagination und Permission-Anforderungen dokumentieren.

---

### F-13 – P2 – Context7/Express-Best-Practices teilweise umgesetzt, teilweise offen

**Beobachtung:** [`backend/src/index.ts`](../backend/src/index.ts:97) nutzt Helmet, CORS ist expliziter als in älterer Dokumentation, Health/Metrics sind vorhanden. Context7/Express empfiehlt zusätzlich klare CORS-Methoden/Header, HTTPS-Erzwingung in Produktion und strikte Input-Validation.

**Risiko:** Ohne produktionsspezifische HTTPS-/Proxy-/Header-/Rate-Limit-Validierung können Security-Annahmen in Deployments abweichen.

**Empfehlung:** Produktionsprofil dokumentieren und testen: `trust proxy`, HTTPS/HSTS, CORS-Allowed-Methods/-Headers, globale und endpoint-spezifische Rate Limits, Request Body Limits je Ressource.

---

### F-14 – P1 – Prisma-Best-Practice: Foreign Keys und Indizes fehlen an vielen fachlichen IDs

**Beobachtung:** Context7/Prisma weist darauf hin, dass Relation-Felder (`@relation(fields: [...], references: [...])`) DB-seitige Foreign-Key-Integrität erzeugen und Foreign-Key-Felder in PostgreSQL nicht automatisch indexiert sind. Im Schema sind viele fachliche IDs ohne Relation/Index modelliert, z. B. Owner-, Reviewer-, Approver-, Source- und Entity-ID-Felder.

**Risiko:** Datenintegrität und Query-Performance können leiden, insbesondere für Reminder, Dashboards, Audit-Reports und Owner-Filter.

**Empfehlung:** Für alle kritischen ID-Felder entscheiden: echte Relation, generische polymorphe Referenz mit Validierungsservice oder bewusst ungebundene externe ID. Danach Indizes passend zu `where`/`orderBy` ergänzen.

---

## ISO27001-/ISMS-Abdeckungsbewertung

| Thema | Abdeckung | Bewertung |
|---|---|---|
| Asset-Inventar | Asset, AssetType, Lifecycle, Relationen, Verträge/Lizenzen, Importquellen | Gut, aber Owner-FK/UX-Lücken |
| Schutzbedarf/Kritikalität | CIA, Datenschutz, Compliance-Relevanz, erweiterte Bewertung | Gut |
| Risikomanagement | RiskMethod-Versionen, Assessments, Treatments, Acceptance, ReviewTasks | Gut, aber Owner-/Approver-Integrität und UI prüfen |
| Controls/SoA | Frameworks, Requirements, Controls, Implementations, SoA, Evidence | Mittel bis gut; Nachweis- und Normalisierungsbedarf |
| Dokumentenlenkung | PolicyDocument, Versions, Acknowledgements, Reviews | Modell vorhanden; UI/API-Abdeckung prüfen/ausbauen |
| Lieferanten | Supplier, Assessments, Relations | Modell vorhanden; Owner/Supplier-Relationen und UI ausbauen |
| Business Continuity | BIA, BCP, Exercises | Modell vorhanden; UI mit UUID-Feldern nicht alltagstauglich |
| Audit/CAPA/Management Review | AuditProgram/Plan/Finding, CorrectiveAction, ManagementReview | Modell vorhanden; Workflow-/Owner-Auswahl verbessern |
| Monitoring/Metrics | Objectives, MetricDefinitions, MetricValues, Reports | Modell vorhanden; Auswertbarkeit und UI-Reife prüfen |
| Security/Access Control | JWT, OIDC, RBAC, EntityAuth, AuditLog | Teils gut, aber P0-Findings F-05 bis F-07 |

---

## Empfohlene Umsetzungsschritte

1. P0-Security-Findings beheben: Secret-Fallback und Token-Logs entfernen, Legacy-Admin-Checks migrieren, EntityAuth Default-Deny einführen.
2. Einheitliches Owner-/User-Selection-Pattern definieren und in allen Masken anwenden: Assets, Risks, Processes, Incidents, ISMS Operations, Documents, Controls, Training, CAPA, BIA/BCP.
3. Datenmodell-Migrationsplan für User-Relationen und kritische Foreign Keys erstellen; vor Migration Datenqualitätsscan für ungültige IDs einplanen.
4. `phase6`-Cleanup als kompatible Umbenennungsstrategie planen: neue fachliche Namen einführen, alte API-Pfade als deprecated Alias erhalten, Dokumentation aktualisieren.
5. OpenAPI und Compliance-Matrix auf tatsächlichen Iststand aktualisieren und pro Endpoint Auth-/Permission-Anforderungen ergänzen.
6. Security-Testmatrix erweitern: Auth, Authorization, CORS, Rate Limiting, OIDC State/Nonce/PKCE, Secrets, Auditlog, Owner-ID-Validierung.
7. Build-/Generated-Artefakte aus dem Review-/Repository-Scope bereinigen und `.gitignore`/CI prüfen.

---

## Verwendete Context7-Best-Practice-Quellen

| Library | Abgeleitete Empfehlung |
|---|---|
| Express | Security Headers, explizite CORS-Konfiguration, HTTPS-Erzwingung in Produktion, Input-Validation und sichere Fehlerbehandlung. |
| Prisma | Echte Relationen mit `@relation(fields, references)` für referenzielle Integrität; Foreign-Key-Felder gezielt indexieren. |
| React | Kein untrusted HTML mit `dangerouslySetInnerHTML`; kontrollierte Formulare; Modal-/Suchkomponenten mit Keyboard- und Accessibility-Verhalten. |

---

## Assessment-Grenzen

- Keine Produktionscode-Änderungen durchgeführt.
- Keine Testläufe oder Builds ausgeführt.
- Keine Live-Datenbank geprüft.
- Bewertung basiert auf statischer Repository-Analyse der genannten Startpunkte und gezielten Such-/Dateilesungen.
