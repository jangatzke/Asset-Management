# Anforderungen – Asset Management System (ISO 27001)

**Version:** 1.0  
**Datum:** 2026-07-17  
**Status:** Entwurf – Phase 0 Prüfbasis

## Phase 6 – Weitere ISMS-Module

| ID | Priorität | Kategorie | Beschreibung | Akzeptanzkriterium |
|----|-----------|-----------|--------------|--------------------|
| SUP-601 | P1 | CTL | Lieferantenmanagement muss Supplier, Assessments sowie Contract-/Risk-Relationen abbilden. | Kritikalität, Datenschutz-/NIS2-Relevanz, Bewertung, Reviewdatum, Maßnahmen und JSON/CSV-Export sind verfügbar. |
| BCP-601 | P1 | OPS | BIA und Business Continuity müssen Prozesse, Services und Assets mit MTPD/RTO/RPO verbinden. | BIA speichert Impact-Kategorien; BCP speichert Version, Recovery Strategies, Übungen, Findings und Due-Date-Reminder. |
| AUD-601 | P1 | AUD | Auditmanagement benötigt Programme, Pläne, Findings und Evidence-Relationen. | Auditstatus, Scope, Auditor/Auditee, Findings, Maßnahmen und Exporte sind persistiert. |
| CAPA-601 | P1 | AUD | Corrective Actions müssen aus Audit, Incident, Risk, Control und Supplier entstehen können. | CAPA speichert Quelle, Owner, DueDate, Statusworkflow, Root Cause und Wirksamkeitsprüfung. |
| TRN-601 | P1 | CTL | Schulungsmanagement benötigt Kurse, Zuweisungen, Abschlüsse, Kenntnisnahmen und Eskalationen. | Trainingszuweisungen sind fälligkeitsbasiert erinnerbar; Completion und Acknowledgement sind nachvollziehbar. |
| MREV-601 | P1 | CTL | Management Reviews müssen Agenda, Inputs, Decisions, Actions, Approval und Minutes speichern. | Review-Actions haben Owner/DueDate; Reviews sind freigabefähig und exportierbar. |
| MET-601 | P1 | CTL | Sicherheitsziele, KPI und KRI benötigen Metrikdefinitionen, Werte, Schwellen und Breach-Erkennung. | MetricValue erkennt warning/critical Breaches und Trend gegen vorherigen Wert. |
| WFL-601 | P1 | OPS | Eine generische Workflowengine muss Definitionen, Instanzen, Tasks, Transitions und Approvals unterstützen. | Workflow kann definiert, instanziiert und über validierte Transitionen fortgeschrieben werden. |
| RPT-601 | P1 | AUD | Reporting und Exporte müssen persistiert, filterbar und auditierbar sein. | ReportRuns und ExportJobs speichern Filter, Format, Payload, RowCount und Auditlog. |

## Phase 7 – Intune-/Microsoft-Graph-Anbindung

| ID | Priorität | Kategorie | Beschreibung | Akzeptanzkriterium |
|----|-----------|-----------|--------------|--------------------|
| INT-701 | P0 | SEC | Intune-Authentifizierung muss MSAL Node mit Zertifikat aus SecretStore-Abstraktion verwenden; Tokens/Secrets dürfen nicht geloggt werden. | `@azure/msal-node` nutzt `.default` Application Permissions; SecretStore unterstützt `env:` und `file:` ohne Default-Secrets. |
| INT-702 | P0 | SEC | Graph-Zugriff muss Least-Privilege Application Permissions prüfen. | Health Check meldet fehlendes `DeviceManagementManagedDevices.Read.All` verständlich. |
| INT-703 | P1 | AST | Managed-Device-Sync muss nur unterstützte Graph-Felder selektieren, Pagination und HTTP 429 `Retry-After` respektieren. | Mehrseitige Antworten werden vollständig verarbeitet und 429 verzögert den Retry nach Header. |
| INT-704 | P1 | AST | Sync muss Assets idempotent matchen/anlegen, FieldLock beachten und FieldProvenance schreiben. | Neues Gerät erzeugt genau ein Asset; Wiederholung erzeugt keine Dublette; gesperrte Felder bleiben unverändert. |
| INT-705 | P1 | AST | Entfernte Intune-Geräte dürfen nicht automatisch archivieren. | Vollständiger Sync markiert betroffene Assets `stale`/prüfbedürftig nach Grace Period. |
| INT-706 | P1 | AUD | Sync, Resync, Health Check und Konfigurationsänderungen müssen auditiert und historisiert werden. | `ImportRun` plus AuditLog enthalten Status, Fehlerzähler und `partial_success` bei Teilfehlern. |

## Phase 4 – Controls, SoA, Evidence und Dokumente

| ID | Priorität | Kategorie | Beschreibung | Akzeptanzkriterium |
|----|-----------|-----------|--------------|--------------------|
| CTL-401 | P1 | CTL | Frameworkversionen, Requirements und Control-Mappings müssen versioniert importierbar sein. Lizenzhinweise sind Pflicht. | Import erzeugt unveränderliche FrameworkVersion mit Requirements; Versionsvergleich liefert added/removed/changed; Control kann mehreren Requirements zugeordnet werden. |
| CTL-402 | P1 | CTL | Control Implementations bilden Umsetzung pro Scope, Organisation oder Standort ab. | Implementation speichert Responsible, Maturity, Testmethode/-frequenz, nächste Prüfung, Findings und Maßnahmen und kann mehrere Requirements erfüllen. |
| CTL-403 | P1 | CTL | Statement of Applicability besteht aus einzelnen SoAItems statt JSON-Gesamtobjekt. | SoAItems enthalten Anwendbarkeit, Begründung, Status, Controls, Risiken, Evidence und werden bei Freigabe unveränderlich. |
| EVD-401 | P1 | AUD | Evidence benötigt sicheres Metadatenmodell mit Hash, Klassifizierung, Retention und Relationen. | Evidence erzwingt SHA-256-Hash, Classification, Retention/Expiry, Relations zu Control/Risk/Asset/SoAItem/Document, Löschschutz und Auditpaketexport. |
| DOC-401 | P1 | AUD | Dokumentenlenkung benötigt Workflow, Versionierung, Kenntnisnahme und Reviews. | Dokumente durchlaufen Entwurf/Prüfung/Freigabe/Veröffentlichung/Rücknahme; freigegebene Versionen sind unveränderlich; Reviews können eskaliert werden. |

## Phase 5 – NIS-2 und Incident-Management

| ID | Priorität | Kategorie | Beschreibung | Akzeptanzkriterium |
|----|-----------|-----------|--------------|--------------------|
| NIS2-501 | P1 | CTL | NIS-2-Betroffenheit muss über versionierten Fragebogen, Vorbewertung und fachliche Freigabe abbildbar sein. | Assessment speichert Questionnaire-Version, Antworten, Preliminary Result, Freigabestatus, Freigeber und Auditlog. |
| NIS2-502 | P1 | CTL | NIS-2-Registrierung benötigt Frist, Kontakt-/Übermittlungsdaten, Nachweis und Änderungsmeldungen. | Registrierung setzt freigegebene Betroffenheit voraus; Übermittlungsnachweis und Änderungsmeldungen werden persistiert und auditiert. |
| NIS2-503 | P1 | CTL | Die zehn NIS-2-Themenbereiche müssen als Requirements und Controls in die Phase-4-Struktur integriert werden. | Endpoint erzeugt FrameworkVersion `NIS2/2024-phase5`, zehn Requirements, zehn Controls und Mappings inklusive Angemessenheitsbegründung. |
| INC-501 | P1 | INC | Signifikanzregeln für NIS-2-Incidents müssen versioniert sein und Fristen automatisch erzeugen. | Meldepflichtige Incidents erzeugen 24h-, 72h-, Zwischen- und Monatsabschluss-Fristen auf Basis des Kenntniszeitpunkts. |
| INC-502 | P1 | INC | Kenntniszeitpunkt ist geschützt und nur mit Begründung änderbar. | Direkte Updates werden abgewiesen; dedizierter Endpoint speichert Änderungsgrund, Historie, Auditlog und berechnet offene Fristen neu. |
| INC-503 | P1 | INC | Nichtmeldung benötigt Begründung und Freigabe. | Assessment lehnt nicht-meldepflichtige Entscheidung ohne Begründung oder Freigeber ab. |
| INC-504 | P1 | INC | Meldepakete müssen persistiert und exportierbar sein. | Reports für 24h, 72h, Zwischenbericht und Monatsabschluss werden gespeichert; Export liefert strukturiertes Paket. |
| INC-505 | P1 | INC | Incident-Abschluss benötigt Root Cause, Lessons Learned beziehungsweise Maßnahmenbewertung und Abschlussbedingungen. | Abschluss wird ohne Root Cause und Maßnahmenbewertung abgewiesen; signifikante Incidents benötigen eingereichten Monatsabschlussbericht. |

## RSK-AGG-3.4: Reproduzierbare Risiko-Aggregationen

| Feld | Wert |
|------|------|
| **ID** | RSK-AGG-3.4 |
| **Priorität** | P1 |
| **Kategorie** | RSK |
| **Beschreibung** | Risiko-Aggregationen müssen ausschließlich normalisierte Relationen verwenden. Asset-, Prozess- und Service-Bezüge laufen über `RiskAsset`, `RiskProcess` und `RiskService`; entfernte ID-Arrays dürfen nicht mehr verwendet werden. |
| **Zählregeln** | Ein Risiko wird innerhalb einer Gruppe genau einmal gezählt (`DISTINCT risk.id`). Hat ein Risiko mehrere Assets/Prozesse/Services, erscheint es in jeder betroffenen Gruppe, wird aber in derselben Gruppe dedupliziert. Ein Risiko mit zwei Assets desselben Asset-Typs zählt in dieser Asset-Typ-Gruppe genau einmal; ein Risiko mit Assets in zwei Standorten zählt einmal pro Standort. |
| **Filterregeln** | `from` und `to` beziehen sich auf `RiskAssessment.assessedAt`. Aktuelle Kennzahlen verwenden standardmäßig `isCurrent=true`; historische Kennzahlen sind über `methodVersionId`, `assessmentType` und Zeitraum reproduzierbar. Weitere Filter: `scope`, `organizationUnitId`, `status`, `riskClass`. |
| **Akzeptanzkriterium** | 1. Aggregationen nach Asset/AssetType, Prozess, Service, Organisation, Scope, Risikoklasse, Status und AssessmentType sind verfügbar. 2. Junction Tables werden verwendet. 3. Pro Gruppe wird dedupliziert. 4. SQL/Prisma-Aggregationen und Batch-Lookups vermeiden N+1. 5. Tests decken Mehrfachzuordnungen und Filter ab. |

---

## Legende

| Feld | Beschreibung |
|------|-------------|
| **ID** | Eindeutige Anforderungs-ID (Kategorie-Nummer) |
| **Titel** | Kurze Bezeichnung |
| **Priorität** | P0 = sicherheitskritisch, P1 = hoch, P2 = mittel, P3 = niedrig |
| **Kategorie** | IAM = Identität/Zugriff, SEC = Sicherheit, AST = Asset, RSK = Risiko, CTL = Control, INC = Incident, AUD = Audit, UX = Benutzererfahrung, OPS = Betrieb |
| **Akzeptanzkriterium** | Überprüfbare Bedingung für Erfüllung |

---

## P0 – Sicherheitskritisch

### AUTHZ-001: Granulare administrative Autorisierung
| Feld | Wert |
|------|------|
| **ID** | AUTHZ-001 |
| **Priorität** | P0 |
| **Kategorie** | IAM |
| **Status** | Implementiert in Phase 1 |
| **Beschreibung** | Administrative Zugriffe müssen über granulare Berechtigungen statt impliziter Rollennamen geschützt werden. |
| **Akzeptanzkriterium** | 1. `administration.access` ist als Permission modelliert. 2. Direkte und gruppenbasierte Rollen werden berücksichtigt. 3. Abgelaufene Rollen sind unwirksam. 4. Tests decken Admin- und Group-Role-Verhalten ab. |

### AUTHZ-002: Granulare scoped Entity-Autorisierung
| Feld | Wert |
|------|------|
| **ID** | AUTHZ-002 |
| **Priorität** | P0 |
| **Kategorie** | IAM |
| **Status** | Implementiert in Phase 1 |
| **Beschreibung** | Assets, Risiken, Controls, Incidents und bestehende ISMS-Module müssen explizite granulare Permissions und optionale Scope-Grenzen über Legal Entity, Organization Unit, ISMS Scope und Site verwenden. |
| **Akzeptanzkriterium** | 1. Permission-Katalog enthält die Phase-1-Mindestpermissions. 2. `AuthorizationService` bietet `can`, `canForEntity`, `buildReadFilter`, `require` und `requireForEntity`. 3. Listen/Suchen filtern Zeilen und Counts mit demselben Authz-Filter. 4. Create/Detail/Write außerhalb Scope ergibt konsistent 403. 5. Tests decken die 12 geforderten Szenarien ab. |

### IAM-001: Administrationsschutz
| Feld | Wert |
|------|------|
| **ID** | IAM-001 |
| **Priorität** | P0 |
| **Kategorie** | IAM |
| **Beschreibung** | Alle Admin-Routen (`/api/v1/admin/*`) müssen prüfen, dass der Benutzer eine Rolle mit `canAccessAdmin = true` besitzt. Die aktuelle Implementierung prüft nur den Legacy-Rollennamen `system_admin`. |
| **Akzeptanzkriterium** | 1. Middleware lädt Rollen aus DB und prüft `canAccessAdmin`-Flag dynamisch. 2. Kein Benutzer ohne entsprechende Rolle kann Admin-API aufrufen (403). 3. Test: Nicht-Admin erhält 403 auf `/admin/users`. |

### IAM-002: Entity-Level Authorization
| Feld | Wert |
|------|------|
| **ID** | IAM-002 |
| **Priorität** | P0 |
| **Kategorie** | IAM |
| **Beschreibung** | CRUD-Operationen auf Assets, Risiken, Controls und Incidents müssen die `entityPermissions` der Benutzerrolle prüfen (none/readonly/readwrite). Aktuell gibt es keine entity-level Prüfung. |
| **Akzeptanzkriterium** | 1. Middleware prüft `entityPermissions` aus UserRole vor jedem CRUD. 2. Readonly-Benutzer erhalten 403 bei POST/PUT/DELETE. 3. None-Benutzer erhalten 403 auf alle Operationen. |

### IAM-003: Routenreihenfolge und Konfliktfreiheit
| Feld | Wert |
|------|------|
| **ID** | IAM-003 |
| **Priorität** | P0 |
| **Kategorie** | IAM |
| **Beschreibung** | Express-Routen müssen in korrekter Reihenfolge registriert sein, sodass spezifische Routen vor generischen gematcht werden. Aktuell besteht Risiko von Route-Shadowing (z.B. `/admin/vmware` vs. `/admin/users/:id`). |
| **Akzeptanzkriterium** | 1. Alle statischen Routen werden vor parametrisierten registriert. 2. Kein Route-Shadowing zwischen Admin-Sub-Routern. 3. Integrationstest deckt alle Routen ab. |

### SEC-001: JWT-Härtung
| Feld | Wert |
|------|------|
| **ID** | SEC-001 |
| **Priorität** | P0 |
| **Kategorie** | SEC |
| **Beschreibung** | JWT-Secret muss aus Umgebungsvariable kommen – kein Fallback auf Hardcoded-Standard. Aktuell: `'secret'` in [`auth.ts`](backend/src/middleware/auth.ts:23) und `'your-super-secret-jwt-key-change-in-production'` in [`auth.service.ts`](backend/src/services/auth.service.ts:282). Algorithmus muss explizit `HS256` sein. |
| **Akzeptanzkriterium** | 1. Anwendung startet mit Fehler, wenn `JWT_SECRET` nicht gesetzt ist. 2. Algorithmus explizit auf `['HS256']` beschränkt. 3. Token-Lifetime ≤ 1 Stunde. |

### SEC-002: OIDC – State, Nonce und PKCE
| Feld | Wert |
|------|------|
| **ID** | SEC-002 |
| **Priorität** | P0 |
| **Kategorie** | SEC |
| **Beschreibung** | OIDC-Flow muss PKCE (Proof Key for Code Exchange) verwenden. State-Parameter muss beim Callback validiert werden. Nonce muss gegen ID-Token geprüft werden. Aktuell: Kein PKCE, State wird nicht validiert (`_state` in [`oidc.service.ts`](backend/src/services/oidc.service.ts:104)). |
| **Akzeptanzkriterium** | 1. Authorization-Request enthält `code_challenge` und `code_challenge_methods=S256`. 2. Token-Exchange enthält `code_verifier`. 3. State wird serverseitig gespeichert und beim Callback validiert. 4. Nonce wird generiert, gespeichert und gegen ID-Token geprüft. |

### SEC-003: CORS-Härtung
| Feld | Wert |
|------|------|
| **ID** | SEC-003 |
| **Priorität** | P0 |
| **Kategorie** | SEC |
| **Beschreibung** | CORS-Origin darf im Produktivbetrieb nicht `*` sein. Aktuell: `origin: process.env.CORS_ORIGIN || '*'` in [`index.ts`](backend/src/index.ts:38). |
| **Akzeptanzkriterium** | 1. `CORS_ORIGIN` muss gesetzt sein – kein Wildcard-Fallback in Production. 2. Origin-Validierung im Request-Handler. |

### SEC-004: Passwort-Policy
| Feld | Wert |
|------|------|
| **ID** | SEC-004 |
| **Priorität** | P0 |
| **Kategorie** | SEC |
| **Beschreibung** | Registrierung und Passwortänderung müssen Mindestanforderungen durchsetzen: Länge ≥ 12, Komplexität (Groß-, Kleinbuchstaben, Ziffern, Sonderzeichen). bcrypt-Round muss ≥ 10 sein. |
| **Akzeptanzkriterium** | 1. Schwache Passwörter werden abgewiesen mit klarem Fehler. 2. bcrypt-Rounds konfigurierbar, Default ≥ 10. 3. Passwort wird nie im Klartext geloggt oder zurückgegeben. |

### SEC-005: Zentrales Auditlog
| Feld | Wert |
|------|------|
| **ID** | SEC-005 |
| **Priorität** | P0 |
| **Kategorie** | AUD |
| **Beschreibung** | Alle signifikanten Aktionen (Auth, CRUD auf Admin-Ressourcen, Konfigurationsänderungen) müssen in der `AuditLog`-Tabelle protokolliert werden. Aktuell: Auditlog-Routen sind Stubs ([`auditLog.routes.ts`](backend/src/routes/auditLog.routes.ts:6)). |
| **Akzeptanzkriterium** | 1. Middleware oder Service-Hook schreibt automatisch Audit-Einträge für alle Admin-Operationen. 2. Einträge enthalten actorId, action, objectId, objectType, timestamp, oldValue, newValue. 3. Auditlog ist schreibgeschützt (kein DELETE). |

### SEC-006: Registrierungsschutz
| Feld | Wert |
|------|------|
| **Priorität** | P0 |
| **Kategorie** | SEC |
| **ID** | SEC-006 |
| **Beschreibung** | Öffentliche Registrierung muss standardmäßig deaktiviert sein. Selbstregistrierung darf nur explizit per Konfiguration zugelassen werden; der Setup-Flow darf ausschließlich den ersten Admin erstellen. Rate-Limiting muss relevante Auth-Endpunkte schützen. |
| **Akzeptanzkriterium** | 1. `POST /auth/register` ist ohne `ALLOW_SELF_REGISTRATION=true` blockiert. 2. `POST /auth/create-first-admin` bleibt nur zulässig, solange noch kein Admin existiert. 3. Rate-Limiter schützt `/auth/login`, `/auth/register`, `/auth/create-first-admin`, `/auth/oidc/authorize` und `/auth/oidc/callback` mit konfigurierbaren Limits pro IP. |

---

## P1 – Hoch

### IAM-004: Display-ID Generierung
| Feld | Wert |
|------|------|
| **ID** | IAM-004 |
| **Priorität** | P1 |
| **Kategorie** | IAM |
| **Beschreibung** | Alle entitätsbasierten Modelle müssen sequenzielle, vorhersagbare Display-IDs erhalten (z.B. `USR-0001`, `AST-0001`, `RSK-0001`). Aktuell: `Date.now()`-basierte IDs in [`auth.service.ts`](backend/src/services/auth.service.ts:217). |
| **Akzeptanzkriterium** | 1. Display-IDs folgen Muster `{Prefix}-{4-stellige Sequenz}`. 2. Sequenz ist pro Entitätstyp eindeutig und lückenlos. |

### AST-001: Asset-Verantwortliche Bestätigung
| Feld | Wert |
|------|------|
| **ID** | AST-001 |
| **Priorität** | P1 |
| **Kategorie** | AST |
| **Beschreibung** | Technische Betreiber, Business Owner und IS-Sicherheitsverantwortliche müssen ihre Zuordnung bestätigen können. Statusfeld `responsibilityConfirmed` pro Rolle. |
| **Akzeptanzkriterium** | 1. API-Endpoint `/assets/:id/confirm-responsibility` existiert. 2. Bestätigung wird auditgeloggt. 3. Unbestätigte Zuordnungen werden im Dashboard angezeigt. |

### AST-002: Vollständige Asset-Felder
| Feld | Wert |
|------|------|
| **ID** | AST-002 |
| **Priorität** | P1 |
| **Kategorie** | AST |
| **Beschreibung** | Asset-Modell muss alle ISO 27001-fordernden Felder abdecken: Vertrags-/Lizenzbezug, Vulnerability/Incident-Relationen, Dokumentenlinks. |
| **Akzeptanzkriterium** | 1. Asset hat Relationen zu Contract, License, Vulnerability, Incident, Document. 2. Alle Felder aus AST-002 in plan.md sind implementiert. |

### RSK-001: Prozessbasierte Risikobewertung
| Feld | Wert |
|------|------|
| **ID** | RSK-001 |
| **Priorität** | P1 |
| **Kategorie** | RSK |
| **Beschreibung** | Risiken müssen sowohl asset-basiert als auch prozess-/szenario-basiert erstellt werden können. BusinessProcess-Modell mit korrekten Relationen. |
| **Akzeptanzkriterium** | 1. BusinessProcess-Modell existiert mit FK-Relation zu Risk. 2. Risiko kann ohne Asset-Zuordnung erstellt werden (prozessbasiert). |

### RSK-002: Aggregierte Risikoverteilungen
| Feld | Wert |
|------|------|
| **ID** | RSK-002 |
| **Priorität** | P1 |
| **Kategorie** | RSK |
| **Beschreibung** | API-Endpunkte für aggregierte Risikoansichten nach Location, Organisationseinheit, Prozess, Asset-Typ und ISMS-Umfang. |
| **Akzeptanzkriterium** | 1. `GET /risks/aggregation?by=orgUnit` returns gruppierte Statistiken. 2. Supported dimensions: orgUnit, site, process, assetType, ismsScope. |

### RSK-003: Risiko-Behandlung und Risiko-Akzeptanz
| Feld | Wert |
|------|------|
| **ID** | RSK-003 |
| **Priorität** | P1 |
| **Kategorie** | RSK |
| **Beschreibung** | Risikoakzeptanz darf nicht als direkter Statuswechsel erfolgen, sondern muss über einen formalen RiskTreatment/RiskAcceptance-Workflow mit Referenz auf eine konkrete RiskAssessment-Version, Pflichtfeldern, rollenabhängiger Genehmigung und Auditierung laufen. Mitigation-Behandlungen benötigen vor Abschluss eine Wirksamkeitsprüfung und ein neues oder bestätigtes Ziel-/Restrisiko-Assessment. |
| **Akzeptanzkriterium** | 1. Kein direkter `/risks/:id/accept`-Bypass existiert. 2. Acceptance verlangt Assessment-Version, Begründung, Ablaufdatum und Genehmiger. 3. Low/medium kann Risk Owner genehmigen; high/critical benötigt unabhängige Management-Freigabe. 4. Approver darf bei high/critical nicht identisch mit Assessor sein. 5. Mitigation kann ohne Effectiveness Review nicht abgeschlossen werden. 6. Abschluss erzeugt oder referenziert ein neues Ziel-/Restrisiko-Assessment ohne historische Assessments zu überschreiben. 7. Alle Aktionen werden auditiert und durch Entity-/Admin-Berechtigungen geschützt. |

### RSK-005: Relationale Risikobewertung und Bewertungshistorie
| Feld | Wert |
|------|------|
| **ID** | RSK-005 |
| **Priorität** | P1 |
| **Kategorie** | RSK |
| **Beschreibung** | Risikobewertungen müssen relational und versioniert abgebildet werden. Szenario, Bedrohung, Schwachstelle, Ursache und Auswirkung dürfen nicht als fachliche JSON-/Stringlisten modelliert werden, wenn Relationen möglich sind. |
| **Akzeptanzkriterium** | 1. Risiko kann mit Scenario, Threat, Vulnerability, Cause und Impact relational erstellt werden. 2. Asset-/Process-/Service-Bezüge werden über Junction Tables gespeichert. 3. Inhärentes, aktuelles und Zielrisiko werden über `RiskAssessment.assessmentType` unterstützt und historisiert. 4. Jede Bewertung erfordert eine Begründung. 5. Neue Bewertung überschreibt historische Bewertungen nicht. 6. Außerplanmäßiges Ereignis erzeugt konkrete ReviewTask. |

### CTL-001: Statement of Applicability
| Feld | Wert |
|------|------|
| **ID** | CTL-001 |
| **Priorität** | P1 |
| **Kategorie** | CTL |
| **Beschreibung** | SoA muss pro Framework-Version und ISMS-Umfang erstellbar sein mit Kontroll-Applicability-Bewertung. |
| **Akzeptanzkriterium** | 1. StatementOfApplicability-Modell existiert (ist vorhanden). 2. API-CRUD für SoA. 3. SoA listet alle Controls des Frameworks mit Applicability-Status. |

### INC-001: Incident-Bewertung und Meldefristen
| Feld | Wert |
|------|------|
| **ID** | INC-001 |
| **Priorität** | P1 |
| **Kategorie** | INC |
| **Beschreibung** | Incident-Assessment-Workflow mit automatischer Berechnung von Meldefristen (72h für DSGB, etc.). NotificationDeadline-Tracking. |
| **Akzeptanzkriterium** | 1. IncidentAssessment kann pro Incident erstellt werden. 2. NotificationDeadlines werden automatisch berechnet. 3. Benachrichtigung bei anstehenden Fristen. |

---

## P2 – Mittel

### AST-003: Asset-Lebenszyklus-Protokollierung
| Feld | Wert |
|------|------|
| **ID** | AST-003 |
| **Priorität** | P2 |
| **Kategorie** | AST |
| **Beschreibung** | Alle Statuswechsel im Asset-Lebenszyklus müssen in `AssetLifecycleLog` protokolliert werden. Bei Disposal: Datenvernichtungs-Nachweis (`disposalEvidence`). |
| **Akzeptanzkriterium** | 1. Lifecycle-Logs werden automatisch bei Statusänderung erstellt. 2. Disposal-Status erfordert `disposalEvidence`. |

### AST-004: Erweiterte Bewertungsdimensionen
| Feld | Wert |
|------|------|
| **ID** | AST-004 |
| **Priorität** | P2 |
| **Kategorie** | AST |
| **Beschreibung** | Asset muss erweiterte Bewertungsdimensionen unterstützen: Personensicherheit, regulatorische Relevanz, finanzieller Schaden, Produktionsausfall. |
| **Akzeptanzkriterium** | 1. Felder `personnelSafetyRelevance`, `regulatoryRelevance`, `financialDamagePotential`, `productionDowntimeImpact` existieren in Asset-Modell. |

### AST-005: Graphvisualisierung (AST-011)
| Feld | Wert |
|------|------|
| **ID** | AST-005 |
| **Priorität** | P2 |
| **Kategorie** | AST |
| **Beschreibung** | Frontend-Komponente zur Visualisierung des Asset-Abhängigkeitsgraphen. Backend-API liefert Knoten/Kanten-Datenstruktur. |
| **Akzeptanzkriterium** | 1. `GET /assets/graph` und `GET /assets/:id/graph` liefern Graph-Daten. 2. Frontend-Komponente rendert interaktiven Graphen. |

### AST-006: Impact Analysis (AST-012)
| Feld | Wert |
|------|------|
| **ID** | AST-006 |
| **Priorität** | P2 |
| **Kategorie** | AST |
| **Beschreibung** | Berechnung der Auswirkungskaskade bei Asset-Ausfall. BFS/DFS-Traversierung des Abhängigkeitsgraphen. |
| **Akzeptanzkriterium** | 1. `GET /assets/:id/impact-analysis` liefert betroffene Assets, Prozesse und Services. 2. Konfigurierbare Traversiertiefe. |

### RSK-003: Risikobehandlungspläne
| Feld | Wert |
|------|------|
| **ID** | RSK-003 |
| **Priorität** | P2 |
| **Kategorie** | RSK |
| **Beschreibung** | RiskTreatment-Model mit Optionen (vermeiden, reduzieren, übertragen, akzeptieren). Akzeptanz erfordert Begründung und Ablaufdatum. |
| **Akzeptanzkriterium** | 1. Treatment mit Option `accept` erfordert `justification` und `expiryDate`. 2. Abgelaufene Acceptances werden im Dashboard angezeigt. |

### UX-001: Internationalisierung (i18n)
| Feld | Wert |
|------|------|
| **ID** | UX-001 |
| **Priorität** | P2 |
| **Kategorie** | UX |
| **Beschreibung** | Frontend unterstützt Mehrsprachigkeit (DE/EN). Benutzerpräferenz wird gespeichert und angewendet. |
| **Akzeptanzkriterium** | 1. Locale-Dateien für DE und EN existieren. 2. Sprachumschaltung im UI. 3. Präferenz persistiert in User-Profil. |

### UX-002: Dark Mode
| Feld | Wert |
|------|------|
| **ID** | UX-002 |
| **Priorität** | P2 |
| **Kategorie** | UX |
| **Beschreibung** | Frontend unterstützt Dark/Light-Mode. Präferenz wird gespeichert und angewendet. |
| **Akzeptanzkriterium** | 1. Toggle im UI. 2. CSS-Variablen für beide Modi. 3. Präferenz persistiert. |

---

## P3 – Niedrig

### OPS-001: Intune-Integration
| Feld | Wert |
|------|------|
| **ID** | OPS-001 |
| **Priorität** | P3 |
| **Kategorie** | OPS |
| **Beschreibung** | Automatische Synchronisation von Intune-Geräten und -Apps mit lokalen Asset-Datensätzen. |
| **Akzeptanzkriterium** | 1. Konfigurierbare Sync-Intervalle. 2. Fehlerbehandlung mit Retry-Logik. 3. Sync-Status im Admin-Dashboard. |

### OPS-002: VMware vCenter-Integration
| Feld | Wert |
|------|------|
| **ID** | OPS-002 |
| **Priorität** | P3 |
| **Kategorie** | OPS |
| **Beschreibung** | Import von VMs aus vCenter in Asset-Datenbank. Credential-Management für vCenter-Server. |
| **Akzeptanzkriterium** | 1. vCenter-Server können konfiguriert werden. 2. VM-Import mit Dry-Run-Option. 3. Doppelte Erkennung und Matching. |

### OPS-003: Proxmox-Integration
| Feld | Wert |
|------|------|
| **ID** | OPS-003 |
| **Priorität** | P3 |
| **Kategorie** | OPS |
| **Beschreibung** | Import von VMs/Containern aus Proxmox VE. API-Token-basierte Authentifizierung. |
| **Akzeptanzkriterium** | 1. Proxmox-Server können konfiguriert werden. 2. VM und Container Import. 3. Credential-Speicherung verschlüsselt. |

### OPS-004: Health Check und Monitoring
| Feld | Wert |
|------|------|
| **ID** | OPS-004 |
| **Priorität** | P3 |
| **Kategorie** | OPS |
| **Beschreibung** | Erweiterte Health-Check-Endpunkte mit DB-Konnektivität, Background-Job-Status und Sync-Gesundheit. |
| **Akzeptanzkriterium** | 1. `/health` prüft DB-Konnektivität. 2. `/health/detailed` liefert Service-Status. |

---

### RSK-004: Versionierte Risikomethoden und Assessment-Historisierung (Paket 3.1)
| Feld | Wert |
|------|------|
| **ID** | RSK-004 |
| **Priorität** | P1 |
| **Kategorie** | RSK |
| **Beschreibung** | Risikomethoden müssen unveränderlich versioniert werden. Jede Risikobewertung (RiskAssessment) muss an eine konkrete Methodenversion (RiskMethodVersion) gebunden sein. Änderungen an einer Methode erzeugen eine neue Version, bestehende Bewertungen bleiben unverändert. Neuberechnungen erzeugen neue Assessment-Versionen statt historische Daten zu überschreiben. |
| **Akzeptanzkriterium** | 1. RiskMethodVersion-Modell mit immutablen Snapshots. 2. RiskAssessment referenziert riskMethodVersionId. 3. Berechnungstypen (product, sum, max, matrix) ohne eval/Function. 4. RecalculatePreview persistiert keine Daten. 5. ConfirmedRecalculation erzeugt neue Assessment-Version. 6. Historische Assessments bleiben nach Methodenversion-Wechsel unverändert. |

## Zusammenfassung

| Priorität | Anzahl | IDs |
|-----------|--------|-----|
| P0 | 6 | IAM-001, IAM-002, IAM-003, SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, SEC-006 |
| P1 | 8 | IAM-004, AST-001, AST-002, RSK-001, RSK-002, RSK-004, CTL-001, INC-001 |
| P2 | 6 | AST-003, AST-004, AST-005, AST-006, RSK-003, UX-001, UX-002 |
| P3 | 4 | OPS-001, OPS-002, OPS-003, OPS-004 |

**Gesamt:** 24 Anforderungen

---

## Phase 8 – API Reife, Betrieb und CI/CD-Gates

| ID | Priorität | Kategorie | Beschreibung | Akzeptanzkriterium |
|----|-----------|-----------|--------------|--------------------|
| API-004 | P0 | API | OpenAPI-Spezifikation muss alle Endpunkte dokumentieren mit request/response schemas, error codes und auth requirements. | `docs/api/openapi.yaml` enthält alle Phase 8 Endpoints; `openapi-cli` generiert client/server stubs ohne Fehler. |
| API-005 | P0 | API | Pagination muss configurable pageLimit haben (default 100, max 1000) mit cursor/basiertem Offset. | Alle list-endpoints unterstützen `?limit=&offset=`; `res.paginateResponse()` setzt korrekte Link-Headers für pagination. |
| API-006 | P0 | API | Sortierung muss über `?sort=field:direction` unterstützt werden mit Whitelist-Validierung gegen Schema-Felder. | `parseSort()` validiert Feldnamen; nur whiteliste Felder sind erlaubt; direction default 'asc'. |
| API-007 | P1 | API | Bulk-Endpunkte müssen atomare Operationen für mehrere Ressourcen mit detaillierten Fehlermeldungen pro Item unterstützen. | `POST /assets/bulk` akzeptiert Array von Operationen; Ergebnis enthält success/error pro Item; max 100 Items/Batch. |
| API-008 | P1 | API | Idempotency Keys müssen POST/PUT/PATCH Requests durch key-basierte Caching vor Duplikaten schützen (TTL 24h). | `X-Idempotency-Key` Header wird validiert; gleiche Key + Body = gespeicherte Antwort; unterschiedliche Body = 409 Conflict. |
| API-009 | P1 | SEC | ETags und optimistisches Locking müssen Resource-Versionierung mit `If-Match`/`If-None-Match` Headern unterstützen. | GET setzt `ETag` Header; PUT mit `If-Match` prüft version; mismatch = 412 Precondition Failed. |
| API-010 | P1 | SEC | Webhooks müssen CRUD-endpoints mit HMAC-SHA256 signature, retry logic und delivery audit haben. | Webhook endpoints erstellen/leschen/testen; `X-Webhook-Signature` Header für payload verification; 5 fehlgeschlagene retries = disabled. |
| API-011 | P1 | SEC | Service Accounts müssen token-basierten API-Zugriff mit scope-based access control und rotation support ermöglichen. | POST `/service-accounts` erzeugt accessToken; scopes begrenzen endpoint access; `POST /:id/regenerate-token` invalidiert alten token. |
| API-012 | P0 | SEC | API-Scopes müssen feingranulare Berechtigungen pro endpoint group mit audit trail implementieren. | `requireScopes('assets:read', 'assets:write')` validiert scope; scope violations werden in `ScopeAuditLog` protokolliert. |
| OPS-005 | P0 | OPS | Strukturierte JSON-Logs müssen alle sensiblen Daten redigieren (passwords, tokens, secrets) vor dem Schreiben. | `redactSensitiveData()` entfernt/maskiert password, token, secret, key, authorization Felder; jsonLogger schreibt strukturiertes JSON. |
| OPS-006 | P0 | OPS | Correlation IDs müssen jeden Request über den gesamten Stack begleiten für request-tracing. | `correlationId()` generiert UUID pro Request; `X-Correlation-ID` Header wird gesetzt/gelesen; jeder Log-Eintrag enthält correlationId. |
| OPS-007 | P0 | OPS | Health Checks müssen liveness (/health/live) und readiness (/health/ready) Probes für Kubernetes unterstützen. | `/health/live` prüft Prozess-alive; `/health/ready` prüft DB-Konnektivität + alle registered checks; Prometheus-metriken unter `/metrics`. |
| OPS-008 | P1 | OPS | Graceful Shutdown muss aktive Requests abschließen, DB-Pool schließen und Signale (SIGTERM/SIGINT) korrekt handhaben. | `gracefulShutdown()` stoppt express server nach idleTimeout; schließt prisma `$disconnect`; SIGTERM/SIGINT triggern shutdown automatisch. |
| OPS-009 | P1 | OPS | Datenbank-Backup und Restore müssen pg_dump/pg_restore basierte Procedures dokumentiert und getestet sein. | Backup enthält schema + data; restore validiert foreign keys; RTO ≤ 4h, RPO ≤ 24h; Disaster Recovery Runbook existiert. |
| OPS-010 | P1 | SEC | Secret Rotation muss JWT_SECRET, database credentials und service account tokens ohne downtime rotieren. | Dual-auth phase supported during rotation; `POST /admin/secrets/rotate` triggert rotation; alte tokens bleiben bis expiry gültig. |
| OPS-011 | P1 | SEC | Container Hardening muss non-root user, read-only filesystem und minimal base image enforce. | Dockerfile nutzt `node:<version>-alpine` + `USER node`; filesystem readonly mit tmpfs für uploads; no sudo/root in container. |
| OPS-012 | P1 | OPS | Environment Separation muss dev/staging/prod Konfiguration über Umgebungsvariablen mit validation enforce. | `.env.example` dokumentiert alle required vars; `zod`-validation beim startup; missing required var = exit with error. |
| CI-001 | P0 | CI/CD | CI-Pipeline muss folgende gates haben: build, lint, prisma validation, unit tests, integration tests, frontend tests, SAST, dependency scan, secret scan, SBOM, container scan. | `.github/workflows/ci.yml` enthält alle 12 jobs; path filtering für relevante changes; failure = PR blocked. |
| CI-002 | P0 | CI/CD | Release-Gates müssen checklist-driven sein mit mandatory code review, test coverage ≥ 80%, security scan pass und changelog entry. | Release workflow prüft: 15+ checks bestanden; 2x approver required; semver tag自动生成; artifacts uploaded zu GitHub Releases. |

### Legende Phase 8 Prioritäten

| Feld | Beschreibung |
|------|-------------|
| **ID** | Eindeutige Anforderungs-ID (Kategorie-Nummer) |
| **Priorität** | P0 = sicherheitskritisch, P1 = hoch |
| **Kategorie** | API = API-Funktionalität, SEC = Sicherheit, OPS = Betrieb, CI/CD = Continuous Integration/Delivery |

---

## Phase 0-5 Technical Consolidation and Hardening Work Packages

These requirements define the ordered consolidation work. They are planning and traceability requirements only; Phase 0 does not claim functional implementation for later phases.

| ID | Phase | Priority | Category | Description | Acceptance criterion |
|----|-------|----------|----------|-------------|----------------------|
| AUTHZ-001 | 1 | P0 | Authorization | Consolidate route-level authorization so administrative APIs depend on role capability flags and not legacy role-name checks. | Admin-only requests are denied with 403 unless an active role grants the required administrative capability; automated tests cover allow and deny paths. |
| AUTHZ-002 | 1 | P0 | Authorization | Consolidate entity-level permissions for assets, risks, controls and incidents. | Read, write and delete actions use one shared permission decision path with tests for none, readonly and readwrite roles. |
| AUTHN-001 | 2 | P0 | Authentication | Harden local authentication bootstrap, self-registration and auth endpoint rate limiting. | Self-registration is disabled by default, first-admin creation is single-use, and login/register/bootstrap endpoints are rate limited. |
| AUTHN-002 | 3 | P0 | Authentication | Add MFA and password pre-authentication hardening for local authentication before privileged access. | Local login returns explicit auth states, uses five-minute purpose-bound pre-auth tokens for MFA/password gates, rejects pre-auth tokens from normal APIs, supports MFA enrollment/verification and expired-password change before session issuance, and audits admin MFA reset/re-enrollment. |
| OIDC-001 | 2 | P0 | OIDC | Harden OIDC state, nonce, PKCE, ID-token validation and account linking. | Authorization requests use PKCE S256 with random backend-generated state and nonce; state is stored only as a hash with TTL and single use; `openid-client` validates ID tokens and callback state/nonce/verifier; tenant mismatch is rejected; existing local accounts are not linked by email alone; client secrets resolve from environment/secret references. |
| AUD-001 | 4 | P0 | Audit | Consolidate audit logging for security-relevant authentication, authorization, admin and configuration events. | Audit entries include actor, action, object type/id, timestamp and before/after values where applicable; audit records are append-only through the API. |
| DTO-001 | 4 | P1 | DTO/API | Consolidate shared DTO and validation contracts across backend and frontend boundaries. | Request and response schemas are defined in the shared package or documented exceptions; backend validation rejects invalid payloads consistently. |
| UI-001 | 5 | P1 | UI | Align frontend security-sensitive flows with consolidated auth/authz/DTO behavior without adding new product modules. | UI handles 401/403/429/validation errors consistently and does not expose controls for operations the current user cannot perform. |
| OPS-013 | 0 | P0 | Operations | Establish reproducible technical baseline documentation before functional refactoring. | Baseline document records commit, date, build/test/lint/Prisma/CI status, counts, warnings and known errors from repository commands. |
| OPS-014 | 5 | P1 | Operations | Stop after Phase 5 for explicit verification and decision gate before later ISMS module work. | Implementation log and refactoring plan include a mandatory stop after Phase 5 with no Phase 6+ implementation in this consolidation track. |
| CI-003 | 0 | P0 | CI/CD | Document CI/CD workflow baseline and verification gaps before changing gates. | Existing workflow jobs and known configuration issues are recorded; missing or failing scripts are documented rather than replaced in Phase 0. |
### AUTHN-003: Refresh-token session management
| Feld | Wert |
|---|---|
| **ID** | AUTHN-003 |
| **Phase** | 2 |
| **Priorität** | P0 |
| **Kategorie** | Authentication |
| **Beschreibung** | Browser sessions must use short-lived access JWTs and rotating, database-backed refresh tokens in HttpOnly cookies. Refresh-token plaintext must never be stored server-side. |
| **Akzeptanzkriterium** | Login creates a session, refresh works with expired access tokens via cookie only, refresh tokens rotate, reuse revokes the family and is audited, logout revokes current refresh token, disabled users cannot refresh, frontend retries once with single-flight refresh. |
| **Status** | Implemented in Phase 2. |
