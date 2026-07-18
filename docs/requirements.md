# Anforderungen – Asset Management System (ISO 27001)

**Version:** 1.0  
**Datum:** 2026-07-17  
**Status:** Entwurf – Phase 0 Prüfbasis

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
| **Beschreibung** | Öffentliche Registrierung muss kontrolliert sein. Entweder deaktivierbar oder auf verifizierte E-Mail-Domains beschränkt. Rate-Limiting auf Auth-Endpunkte. |
| **Akzeptanzkriterium** | 1. Registrierung kann über Konfiguration deaktiviert werden. 2. Rate-Limiter auf `/auth/login`, `/auth/register` (max 5 Versuche/Minute/IP). |

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

## Zusammenfassung

| Priorität | Anzahl | IDs |
|-----------|--------|-----|
| P0 | 6 | IAM-001, IAM-002, IAM-003, SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, SEC-006 |
| P1 | 7 | IAM-004, AST-001, AST-002, RSK-001, RSK-002, CTL-001, INC-001 |
| P2 | 6 | AST-003, AST-004, AST-005, AST-006, RSK-003, UX-001, UX-002 |
| P3 | 4 | OPS-001, OPS-002, OPS-003, OPS-004 |

**Gesamt:** 23 Anforderungen
