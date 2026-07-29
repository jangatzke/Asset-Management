# Asset Management ISMS

IT-Asset-Management- und ISMS-Anwendung für Asset-Inventarisierung, Risiko- und Kontrollmanagement, Incident-Management, Nachweise, Integrationen und technische Application-Coverage für ISO 27001:2022, NIS-2 und BSI-nahe Anforderungen.

> **Wichtiger Compliance-Hinweis:** Dieses Repository dokumentiert technische Abdeckung durch die Anwendung. Es ist keine ISO-27001-Zertifizierung und kein Nachweis organisatorischer Compliance. Organisatorische Compliance erfordert separate Audit-Nachweise wie Richtlinien, Verfahren, Schulungsunterlagen und freigegebene Nachweispakete.

## Inhaltsverzeichnis

- [Status und Highlights](#status-und-highlights)
- [Architektur und Module](#architektur-und-module)
- [Technologie-Stack](#technologie-stack)
- [Projektstruktur](#projektstruktur)
- [Voraussetzungen](#voraussetzungen)
- [Quickstart](#quickstart)
- [Konfiguration](#konfiguration)
- [Entwicklung, Tests und Build](#entwicklung-tests-und-build)
- [API und OpenAPI](#api-und-openapi)
- [Operations, Security und Compliance](#operations-security-und-compliance)
- [Kostenplanung und Fiscal-Year-Setup](#kostenplanung-und-fiscal-year-setup)
- [Dokumentation](#dokumentation)
- [Roadmap und Projektstatus](#roadmap-und-projektstatus)
- [Lizenz](#lizenz)

---

## Status und Highlights

Das Projekt ist als npm-Workspace mit `backend`, `frontend` und `shared` aufgebaut. Der aktuelle Repository-Stand enthält:

- Backend-API mit Express, TypeScript, Prisma ORM und PostgreSQL.
- React/Vite-Frontend mit TypeScript, Routing, i18n-Dateien für Deutsch/Englisch und Dark-Mode-Kontext.
- Gemeinsame Typen und DTOs im `shared` Workspace.
- Prisma-Schema, Seed-Logik und migrations-/runtimebezogene Hilfsskripte im Backend.
- Tests für Backend und Frontend, einschließlich Asset-, Audit-, Risiko-/Workflow-, API- und UI-Hilfsfunktionen.
- OpenAPI-Spezifikation unter [`docs/api/openapi.yaml`](docs/api/openapi.yaml).
- Projektdokumentation zu Anforderungen, Architektur, Betrieb, Security und Compliance unter [`docs`](docs).

Fachlich sichtbare Schwerpunkte im Repository sind Asset Management, Risiko- und Kontrollmanagement, Business Processes, Incidents, Contracts, Licenses, Evidence, Document Control, Framework-/NIS-2-Funktionen, ISMS-Operations-Module, Cost Planning sowie Integrationen für Microsoft Intune, VMware vCenter und Proxmox.

---

## Architektur und Module

### Workspace-Module

| Modul | Zweck | Zentrale Dateien |
|---|---|---|
| `backend` | Express-API, Prisma-Datenzugriff, Authentifizierung, Autorisierung, Integrationen, Scheduler, Health, Metrics | [`backend/src/index.ts`](backend/src/index.ts), [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma), [`backend/package.json`](backend/package.json) |
| `frontend` | React Single Page Application mit Vite, Seiten, Komponenten, API-Client, i18n und Dark Mode | [`frontend/src/App.tsx`](frontend/src/App.tsx), [`frontend/src/main.tsx`](frontend/src/main.tsx), [`frontend/package.json`](frontend/package.json) |
| `shared` | Geteilte TypeScript-Typen und DTOs für Backend/Frontend-Verträge | [`shared/src/index.ts`](shared/src/index.ts), [`shared/src/dtos/index.ts`](shared/src/dtos/index.ts), [`shared/package.json`](shared/package.json) |
| `docs` | Anforderungen, Architektur, Betrieb, Security, Compliance, OpenAPI und Verifikationsartefakte | [`docs/requirements.md`](docs/requirements.md), [`docs/architecture.md`](docs/architecture.md), [`docs/operations.md`](docs/operations.md), [`docs/security-model.md`](docs/security-model.md) |

### Backend-Routen und Querschnittsfunktionen

Die API registriert Ressourcen unter `/api/v1/*` sowie Health-/Monitoring-Endpunkte. Sichtbar registrierte Bereiche sind u. a. Auth, Users, Assets, Risks, Controls, Incidents, Organization, Admin, Audit Logs, Intune, VMware, Proxmox, Contracts, Licenses, Processes, Treatments, Methods, Imports, Frameworks, Evidence, Documents, NIS-2, Phase 6/ISMS Operations, Catalog, Cost Planning, Webhooks und Service Accounts.

Querschnittsfunktionen laut Repository-Stand:

- Correlation IDs, strukturierte JSON-Logs, Metrics-Middleware und geschützte Metrics-Ausgabe.
- Health-Endpunkte für Basic Health, Liveness und Readiness.
- ETag-Unterstützung für zentrale Ressourcenrouten.
- Idempotency-Middleware für Webhooks und Service Accounts.
- Scope-Audit, zentrale Fehlerbehandlung und Graceful-Shutdown-Setup.
- Hintergrunddienste für Intune-Synchronisation und Reminder-Scheduler.

### Datenmodell

Das Datenmodell wird über Prisma in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) definiert. Die Architektur- und Security-Dokumente beschreiben u. a. normalisierte Modelle für Assets, Asset-Beziehungen, Risiken, Risk Assessments, Controls, Control Implementations, Evidence Links, Audit Logs, Organisation, Benutzer/Rollen/Gruppen, OIDC, Verträge, Lizenzen, Integrationen und ISMS-Operations-Objekte.

---

## Technologie-Stack

| Ebene | Technologien |
|---|---|
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Datenbank | PostgreSQL |
| Frontend | React 18, TypeScript, Vite |
| UI | Material UI, Tailwind CSS, Headless UI, Heroicons |
| Routing/State | React Router DOM, Zustand |
| Formulare/i18n/Charts | React Hook Form, react-i18next, Recharts |
| HTTP/Validation/Auth | Axios, Zod, JWT, OpenID Connect |
| Tests | Jest, ts-jest, Supertest, Vitest |
| Tooling | npm Workspaces, ESLint, Prettier, TypeScript |

---

## Projektstruktur

```text
asset-management-isms/
├── backend/                 # Express API, Prisma, Routen, Middleware, Tests
│   ├── prisma/              # Prisma Schema, Seed und migrationsnahe SQL-Dateien
│   └── src/                 # API Entry Point, Middleware, Routen, Services, Tests
├── frontend/                # React/Vite SPA
│   └── src/                 # App, Komponenten, Pages, Contexts, Locales, Services
├── shared/                  # Gemeinsame Typen und DTOs
│   └── src/
├── docs/                    # Anforderungen, Architektur, Betrieb, Security, Compliance, OpenAPI
├── plans/                   # Umsetzungspläne für einzelne Arbeitspakete
├── scripts/                 # Prüfskripte, z. B. Requirements- und Vulnerability-Checks
├── package.json             # Root-Workspace und projektweite Skripte
└── README.md                # Projektüberblick
```

---

## Voraussetzungen

- Node.js ab Version 18.
- npm ab Version 9.
- PostgreSQL für lokale Entwicklung und Tests gegen eine echte Datenbank.
- Optional: Zugriffsdaten/Berechtigungen für Microsoft Intune, VMware vCenter oder Proxmox, wenn diese Integrationen verwendet werden.

---

## Quickstart

### 1. Abhängigkeiten installieren

```powershell
npm install
```

Der Root-Workspace installiert Abhängigkeiten für `backend`, `frontend` und `shared`.

### 2. Backend-Umgebung konfigurieren

```powershell
Copy-Item backend/.env.example backend/.env
```

Anschließend [`backend/.env`](backend/.env.example) sinngemäß konfigurieren. Mindestens erforderlich ist eine gültige `DATABASE_URL`; produktionsnahe Umgebungen benötigen außerdem robuste Secrets wie `JWT_SECRET` und passende CORS-/Token-Konfiguration.

### 3. Prisma vorbereiten

```powershell
npm run db:generate --workspace=backend
npm run db:deploy --workspace=backend
```

Für lokale Entwicklungsdaten kann zusätzlich der Seed ausgeführt werden:

```powershell
npm run db:seed --workspace=backend
```

### 4. Anwendung starten

```powershell
npm run dev
```

Standardmäßig nutzt das Frontend den Vite-Port `3000`; das Backend fällt in der lokalen Entwicklung auf `3001` zurück, wenn `PORT=3000` mit dem Frontend kollidieren würde.

Nützliche lokale Endpunkte:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Health: `http://localhost:3001/health`, `http://localhost:3001/health/live`, `http://localhost:3001/health/ready`
- Metrics: `http://localhost:3001/metrics`

---

## Konfiguration

Die zentrale Backend-Konfiguration erfolgt über [`backend/.env`](backend/.env.example). Relevante Variablengruppen sind:

| Gruppe | Beispiele | Zweck |
|---|---|---|
| Basis | `NODE_ENV`, `HOST`, `PORT`, `DATABASE_URL` | Runtime, Netzwerkbindung und Datenbankverbindung |
| Auth/Sessions | `JWT_SECRET`, Token-Lifetimes, Pre-Auth-/MFA-Konfigurationen | Lokale Authentifizierung, JWTs, Session-/Refresh-Flows |
| CORS/HTTP | `CORS_ORIGINS`, Rate-Limit-Optionen, Upload-Limits | Browserzugriff, API-Härtung und Request-Grenzen |
| Monitoring | `METRICS_TOKEN`, Log-/Health-bezogene Variablen | Zugriff auf Metrics und Betriebsbeobachtung |
| Integrationen | `INTUNE_*`, `VMWARE_ENCRYPTION_KEY`, Proxmox-/Webhook-/SMTP-nahe Variablen | Externe Systeme und Hintergrundjobs |

Details zu Betriebsvariablen und Produktionsaspekten stehen in [`docs/operations.md`](docs/operations.md) und [`docs/security-model.md`](docs/security-model.md).

---

## Entwicklung, Tests und Build

### Root-Skripte

| Skript | Zweck |
|---|---|
| `npm run dev` | Backend und Frontend parallel starten |
| `npm run dev:backend` | Backend im Watch-Modus starten |
| `npm run dev:frontend` | Vite-Frontend starten |
| `npm run build` | Alle Workspace-Builds ausführen, sofern vorhanden |
| `npm run test` | Tests in Workspaces ausführen, sofern vorhanden |
| `npm run lint` | Linting in Workspaces ausführen, sofern vorhanden |
| `npm run format` | Prettier für TypeScript, JavaScript und JSON ausführen |
| `npm run requirements-check` | Requirements-Prüfskript ausführen |
| `npm run vulnerability-check` | Vulnerability-/Allowlist-Prüfskript ausführen |

### Backend-Skripte

| Skript | Zweck |
|---|---|
| `npm run dev --workspace=backend` | Express/TypeScript-Backend mit `tsx watch` starten |
| `npm run build --workspace=backend` | Backend-TypeScript kompilieren |
| `npm run start --workspace=backend` | kompiliertes Backend aus `dist` starten |
| `npm run test --workspace=backend` | Jest-Tests ausführen |
| `npm run lint --workspace=backend` | ESLint für Backend-Quellen ausführen |
| `npm run db:generate --workspace=backend` | Prisma Client generieren |
| `npm run db:deploy --workspace=backend` | Prisma-Migrationen deployen |
| `npm run db:migrate --workspace=backend` | Prisma Migrate Dev ausführen |
| `npm run db:seed --workspace=backend` | Seed-Skript ausführen |
| `npm run db:setup:cost-planning --workspace=backend` | Cost-Planning-relevante Migrationen deployen und Prisma Client generieren |

### Frontend- und Shared-Skripte

| Workspace | Skripte |
|---|---|
| `frontend` | `dev`, `build`, `preview`, `test`, `lint` |
| `shared` | `build`, `clean` |

Empfohlene schnelle Prüfung nach Änderungen:

```powershell
npm run build
npm run test
npm run lint
npm run requirements-check
```

Bei Prisma-/Datenmodelländerungen zusätzlich:

```powershell
npm run db:generate --workspace=backend
npm run db:deploy --workspace=backend
```

---

## API und OpenAPI

Die API ist versioniert unter `/api/v1`. Die registrierten Routen im Backend umfassen u. a.:

| Bereich | Basispfad |
|---|---|
| Auth und Benutzer | `/api/v1/auth`, `/api/v1/users` |
| Kernobjekte | `/api/v1/assets`, `/api/v1/risks`, `/api/v1/controls`, `/api/v1/incidents` |
| Organisation und Administration | `/api/v1/organization`, `/api/v1/admin` |
| Audit und Nachweise | `/api/v1/audit-logs`, `/api/v1/evidence`, `/api/v1/documents` |
| ISMS/Compliance | `/api/v1/frameworks`, `/api/v1/nis2`, `/api/v1/phase6`, `/api/v1/isms-operations`, `/api/v1/catalog` |
| Wirtschaftliche Objekte | `/api/v1/contracts`, `/api/v1/licenses`, `/api/v1/cost-planning` |
| Integrationen | `/api/v1/intune`, `/api/v1/admin/vmware`, `/api/v1/admin/proxmox`, `/api/v1/imports` |
| Automatisierung | `/api/v1/webhooks`, `/api/v1/service-accounts` |

Die OpenAPI-Spezifikation liegt in [`docs/api/openapi.yaml`](docs/api/openapi.yaml). Sie sollte als primäre Referenz für dokumentierte API-Verträge verwendet und bei API-Änderungen aktualisiert werden.

---

## Operations, Security und Compliance

### Operations

[`docs/operations.md`](docs/operations.md) beschreibt Health Checks, Readiness, Metrics, strukturierte Logs, Correlation IDs, Backup/Restore, Secret Rotation, Environment Separation, Graceful Shutdown, CI/CD-Gates und Runbooks. Im Code sichtbar sind Health-Endpunkte, Metrics-Middleware, JSON-Logging, Correlation-ID-Middleware und Graceful-Shutdown-Integration.

### Security

[`docs/security-model.md`](docs/security-model.md) beschreibt Sicherheitsziele, lokale Authentifizierung, OIDC/Entra-ID-Flows, RBAC, Entity-Level Authorization, Admin-Zugriffsschutz, Auditlog, Netzwerk-/CORS-Anforderungen, Passwortregeln und Datensicherheit. Die Implementierung enthält Middleware und Routen für Authentifizierung, API-Scopes, Admin-Funktionen, Audit Logs und OIDC-bezogene Abläufe.

### Compliance-Modell

[`docs/compliance-matrix.md`](docs/compliance-matrix.md) und [`docs/compliance-matrix.yml`](docs/compliance-matrix.yml) unterscheiden ausdrücklich zwischen:

- **Application Coverage:** Die Anwendung unterstützt eine Anforderung technisch.
- **Application Requirement Coverage:** Die Anwendung ordnet Anforderungen technischer Funktionsabdeckung zu.
- **Organization Compliance Assessment:** Die Organisation hat Kontrollen umgesetzt und kann Nachweise bereitstellen.

Statusangaben im Repository sind daher als technische Projekt-/Anwendungsabdeckung zu lesen, nicht als organisatorische Zertifizierung.

---

## Kostenplanung und Fiscal-Year-Setup

Das Cost-Planning-Modul ist im Backend über `/api/v1/cost-planning` registriert und besitzt eine eigene Frontend-Seite [`frontend/src/pages/CostPlanning.tsx`](frontend/src/pages/CostPlanning.tsx) sowie Administrationsbezug zur Fiscal-Year-Konfiguration.

Für die lokale oder produktionsnahe Datenbank müssen die Prisma-Migrationen vor Nutzung der Cost-Planning-/Fiscal-Year-Seiten angewendet werden:

```powershell
npm run db:setup:cost-planning --workspace=backend
```

Das Skript führt im Backend `prisma migrate deploy` und `prisma generate` aus. Für produktionsähnliche Umgebungen ist `npm run db:deploy --workspace=backend` ausreichend, wenn die Prisma-Client-Generierung separat erfolgt. Die Anwendung soll die Cost-Planning-Tabellen nicht aus Request-Handlern erzeugen oder ändern; fehlt die Migration, soll die API einen verständlichen Setup-Fehler statt eines ungefangenen Prisma-Tabellenfehlers liefern.

---

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [`docs/requirements.md`](docs/requirements.md) | Funktionale und nicht-funktionale Anforderungen, Phasen und Akzeptanzkriterien |
| [`docs/architecture.md`](docs/architecture.md) | Ist-/Zielarchitektur, Backend-/Frontend-Struktur, Datenmodell, Sicherheits- und API-Aspekte |
| [`docs/operations.md`](docs/operations.md) | Betriebsmanual mit Health, Monitoring, Logging, Backup/Restore, DR und Runbooks |
| [`docs/security-model.md`](docs/security-model.md) | Sicherheitsmodell für Authentifizierung, Autorisierung, Audit, Netzwerk und Daten |
| [`docs/compliance-matrix.md`](docs/compliance-matrix.md) | Lesbare Compliance-/Application-Coverage-Matrix |
| [`docs/compliance-matrix.yml`](docs/compliance-matrix.yml) | Maschinenlesbare Compliance-/Application-Coverage-Matrix |
| [`docs/api/openapi.yaml`](docs/api/openapi.yaml) | OpenAPI-Spezifikation |
| [`docs/implementation-log.md`](docs/implementation-log.md) | Implementierungs- und Änderungshistorie |
| [`docs/final-verification-report.md`](docs/final-verification-report.md) | Verifikations-/Validierungsbericht |
| [`docs/refactoring-plan.md`](docs/refactoring-plan.md) | Refactoring-Plan |
| [`docs/refactoring-baseline.md`](docs/refactoring-baseline.md) | Baseline zum Refactoring-Stand |

Zusätzliche phasenbezogene Planungsdokumente liegen unter [`docs`](docs) und [`plans`](plans).

---

## Roadmap und Projektstatus

Der aktuelle Projektstand ist phasen- und dokumentationsgetrieben. Anforderungen und Umsetzungsstände sind in [`docs/requirements.md`](docs/requirements.md), [`docs/implementation-log.md`](docs/implementation-log.md), [`docs/refactoring-plan.md`](docs/refactoring-plan.md) und den phasenbezogenen Dokumenten unter [`docs`](docs) nachvollziehbar.

Für neue Arbeiten gilt:

- Anforderungen und Akzeptanzkriterien zuerst in den vorhandenen Requirements-/Planungsdokumenten prüfen.
- API-Änderungen mit [`docs/api/openapi.yaml`](docs/api/openapi.yaml), Backend-Validierung und Shared-DTOs abstimmen.
- Security-, Operations- und Compliance-Aussagen nur als technische Application-Coverage formulieren.
- Migrationen und Prisma-Client-Generierung reproduzierbar über Backend-Skripte ausführen.
- Build, Tests, Linting und projektbezogene Prüfskripte vor Abschluss ausführen, soweit für die Änderung sinnvoll.

---

## Lizenz

Dieses Projekt ist proprietäre Software. Alle Rechte vorbehalten.
