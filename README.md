# Asset Management ISMS

IT asset management and ISMS application for asset inventory, risk and control management, incident management, evidence, integrations, and technical application coverage for ISO 27001:2022, NIS 2, and BSI-aligned requirements.

> **Important compliance note:** This repository documents technical coverage provided by the application. It is not an ISO 27001 certification and does not provide evidence of organizational compliance. Organizational compliance requires separate audit evidence such as policies, procedures, training records, and approved evidence packages.

## Table of Contents

- [Status and Highlights](#status-and-highlights)
- [Architecture and Modules](#architecture-and-modules)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [Development, Tests, and Build](#development-tests-and-build)
- [API and OpenAPI](#api-and-openapi)
- [Operations, Security, and Compliance](#operations-security-and-compliance)
- [Cost Planning and Fiscal Year Setup](#cost-planning-and-fiscal-year-setup)
- [Documentation](#documentation)
- [Roadmap and Project Status](#roadmap-and-project-status)
- [License](#license)

---

## Status and Highlights

The project is structured as an npm workspace with `backend`, `frontend`, and `shared`. The current repository state includes:

- Backend API with Express, TypeScript, Prisma ORM, PostgreSQL runtime support, and provider-specific Microsoft SQL Server runtime support.
- React/Vite frontend with TypeScript, routing, i18n files for German/English, and dark mode context.
- Shared types and DTOs in the `shared` workspace.
- Prisma schema, seed logic, and migration-/runtime-related helper scripts in the backend.
- Tests for backend and frontend, including asset, audit, risk/workflow, API, and UI helper functions.
- OpenAPI specification at [`docs/api/openapi.yaml`](docs/api/openapi.yaml).
- Project documentation for requirements, architecture, operations, security, and compliance under [`docs`](docs).

The main functional areas visible in the repository are asset management, risk and control management, business processes, incidents, contracts, licenses, evidence, document control, framework/NIS 2 features, ISMS operations modules, cost planning, and integrations for Microsoft Intune, VMware vCenter, and Proxmox.

---

## Architecture and Modules

### Workspace Modules

| Module | Purpose | Key Files |
|---|---|---|
| `backend` | Express API, Prisma data access, authentication, authorization, integrations, scheduler, health, metrics | [`backend/src/index.ts`](backend/src/index.ts), [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma), [`backend/package.json`](backend/package.json) |
| `frontend` | React single-page application with Vite, pages, components, API client, i18n, and dark mode | [`frontend/src/App.tsx`](frontend/src/App.tsx), [`frontend/src/main.tsx`](frontend/src/main.tsx), [`frontend/package.json`](frontend/package.json) |
| `shared` | Shared TypeScript types and DTOs for backend/frontend contracts | [`shared/src/index.ts`](shared/src/index.ts), [`shared/src/dtos/index.ts`](shared/src/dtos/index.ts), [`shared/package.json`](shared/package.json) |
| `docs` | Requirements, architecture, operations, security, compliance, OpenAPI, and verification artifacts | [`docs/requirements.md`](docs/requirements.md), [`docs/architecture.md`](docs/architecture.md), [`docs/operations.md`](docs/operations.md), [`docs/security-model.md`](docs/security-model.md) |

### Backend Routes and Cross-Cutting Features

The API registers resources under `/api/v1/*` as well as health/monitoring endpoints. Visibly registered areas include auth, users, assets, risks, controls, incidents, organization, admin, audit logs, Intune, VMware, Proxmox, contracts, licenses, processes, treatments, methods, imports, frameworks, evidence, documents, NIS 2, Phase 6/ISMS operations, catalog, cost planning, webhooks, and service accounts.

Cross-cutting features according to the current repository state:

- Correlation IDs, structured JSON logs, metrics middleware, and protected metrics output.
- Health endpoints for basic health, liveness, and readiness.
- ETag support for central resource routes.
- Idempotency middleware for webhooks and service accounts.
- Scope audit, central error handling, and graceful shutdown setup.
- Background services for Intune synchronization and reminder scheduling.

### Data Model

The data model is defined via Prisma in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). The architecture and security documents describe normalized models for assets, asset relationships, risks, risk assessments, controls, control implementations, evidence links, audit logs, organization, users/roles/groups, OIDC, contracts, licenses, integrations, and ISMS operations objects.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL default; Microsoft SQL Server via generated provider-specific Prisma schema and portable JSON export/import for DBMS switching |
| Frontend | React 18, TypeScript, Vite |
| UI | Material UI v9 (@mui/material), Tailwind CSS, Headless UI v2 (@headlessui/react), Heroicons |
| Routing/State | React Router DOM v6.30.4 (pinned), Zustand |
| Forms/i18n/Charts | React Hook Form, react-i18next v17, Recharts |
| HTTP/Validation/Auth | Axios, Zod, JWT, OpenID Connect |
| Tests | Jest, ts-jest, Supertest, Vitest |
| Tooling | npm Workspaces, ESLint, Prettier, TypeScript |
| Security/Infrastructure (Backend) | helmet, compression, prom-client, @azure/msal-node, nodemailer, multer |
| Icon Library (Frontend) | @mui/icons-material |

---

## Project Structure

```text
asset-management-isms/
├── backend/                 # Express API, Prisma, routes, middleware, tests
│   ├── prisma/              # Prisma schema, seed, and migration-related SQL files
│   └── src/                 # API entry point, middleware, routes, services, tests
├── frontend/                # React/Vite SPA
│   └── src/                 # App, components, pages, contexts, locales, services
├── shared/                  # Shared types and DTOs
│   └── src/
├── docs/                    # Requirements, architecture, operations, security, compliance, OpenAPI
├── plans/                   # Implementation plans for individual work packages
├── scripts/                 # Check scripts, e.g. requirements and vulnerability checks
├── package.json             # Root workspace and project-wide scripts
└── README.md                # Project overview
```

---

## Prerequisites

- Node.js version 18 or later.
- npm version 9 or later.
- PostgreSQL for default local development and tests against a real database, or Microsoft SQL Server when `DB_PROVIDER=sqlserver` is configured and the SQL Server Prisma schema/client path is generated.
- Optional: credentials/permissions for Microsoft Intune, VMware vCenter, or Proxmox if these integrations are used.

---

## Quickstart

### 1. Install Dependencies

```powershell
npm install
```

The root workspace installs dependencies for `backend`, `frontend`, and `shared`.

### 2. Configure the Backend Environment

```powershell
Copy-Item backend/.env.example backend/.env
```

Then configure [`backend/.env`](backend/.env.example) as appropriate. At minimum, a valid `DATABASE_URL` is required; production-like environments also require robust secrets such as `JWT_SECRET` and suitable CORS/token configuration.

### 3. Prepare Prisma

```powershell
npm run db:generate --workspace=backend
npm run db:deploy --workspace=backend
```

For local development data, the seed can also be executed:

```powershell
npm run db:seed --workspace=backend
```

### 4. Start the Application

```powershell
npm run dev
```

By default, the frontend uses Vite port `3000`; in local development, the backend falls back to `3001` if `PORT=3000` would conflict with the frontend.

Useful local endpoints:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Health: `http://localhost:3001/health`, `http://localhost:3001/health/live`, `http://localhost:3001/health/ready`
- Metrics: `http://localhost:3001/metrics`

---

## Configuration

The central backend configuration is provided through [`backend/.env`](backend/.env.example). Relevant groups of variables include:

| Group | Examples | Purpose |
|---|---|---|
| Base | `NODE_ENV`, `HOST`, `PORT`, `DB_PROVIDER`, `DATABASE_URL`, `DATABASE_URL_FILE` | Runtime, network binding, and database connection |
| Auth/Sessions | `JWT_SECRET`, token lifetimes, pre-auth/MFA configurations | Local authentication, JWTs, session/refresh flows |
| CORS/HTTP | `CORS_ORIGINS`, rate limit options, upload limits | Browser access, API hardening, and request limits |
| Monitoring | `METRICS_TOKEN`, log/health-related variables | Access to metrics and operational observability |
| Integrations | `INTUNE_*`, `VMWARE_ENCRYPTION_KEY`, Proxmox/webhook/SMTP-related variables | External systems and background jobs |

Details on operational variables and production considerations are available in [`docs/operations.md`](docs/operations.md) and [`docs/security-model.md`](docs/security-model.md).

### Database provider configuration and migration / Datenbankanbieter und Migration

The backend database runtime is configured in [`backend/.env`](backend/.env.example) and validated by [`backend/src/config/database.ts`](backend/src/config/database.ts). The supported `DB_PROVIDER` values are:

| Provider | `DB_PROVIDER` value | URL scheme | Current use |
|---|---|---|---|
| PostgreSQL | `postgresql` | `postgresql://` or `postgres://` | Default and directly supported runtime provider for the current Prisma schema |
| Microsoft SQL Server | `sqlserver` | `sqlserver://` | Direct runtime through generated [`backend/prisma/schema.sqlserver.prisma`](backend/prisma/schema.sqlserver.prisma), with JSON-like fields stored as `NVARCHAR(MAX)` JSON text |

The backend rejects mismatched combinations such as `DB_PROVIDER=sqlserver` with a PostgreSQL URL. The admin status endpoint `GET /api/v1/admin/database/config` returns only safe metadata (`provider`, URL source, portable backup format, and known limitations); it never returns the database password or full connection URL.

Provider-aware Prisma commands are routed through [`backend/scripts/prisma-provider.cjs`](backend/scripts/prisma-provider.cjs). With `DB_PROVIDER=postgresql`, they use [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). With `DB_PROVIDER=sqlserver`, they generate and use [`backend/prisma/schema.sqlserver.prisma`](backend/prisma/schema.sqlserver.prisma). The SQL Server schema keeps model names compatible with the application but adapts Prisma features not supported by the SQL Server connector:

- Prisma `Json` fields become `String` columns with `@db.NVarChar(Max)` and JSON text content.
- Prisma scalar list fields such as `String[]` become JSON text columns with `@db.NVarChar(Max)`.
- Prisma enums become string-backed fields.
- Referential actions are normalized to SQL Server-compatible `NoAction` to avoid multiple-cascade-path validation failures.

The backend runtime enables `nvarchar-json-text` compatibility mode for SQL Server and serializes/deserializes these JSON-backed fields at the Prisma boundary for ordinary create/update/read operations, preserving API payload semantics as closely as possible.

#### PostgreSQL example with `DATABASE_URL`

Use this format for local development or deployments where the secret is injected securely through the process environment:

```env
DB_PROVIDER=postgresql
DATABASE_URL="postgresql://postgres:<password>@localhost:5432/asset_management?schema=public"
```

#### Microsoft SQL Server example with `sqlserver://`

Use the Prisma SQL Server URL style when configuring a SQL Server target. Keep credentials outside source control and set TLS options according to the database server certificate setup:

```env
DB_PROVIDER=sqlserver
DATABASE_URL="sqlserver://localhost:1433;database=asset_management;user=asset_user;password=<password>;encrypt=true;trustServerCertificate=false"
```

For development instances with a self-signed certificate, `trustServerCertificate=true` may be necessary, but production deployments should prefer a trusted certificate and `trustServerCertificate=false`.

Generate the SQL Server Prisma Client and validate the provider-specific schema after configuring `DB_PROVIDER=sqlserver`:

```powershell
npm run db:schema:sqlserver --workspace=backend
npm run db:generate --workspace=backend
npm run db:validate --workspace=backend
```

For a new SQL Server deployment, generate the initial migration against an empty target database, review the generated SQL, and then deploy it in controlled environments:

```powershell
npm run db:migrate:sqlserver --workspace=backend
npm run db:deploy:sqlserver --workspace=backend
```

#### Secure credential handling with `DATABASE_URL_FILE`

Real database credentials must not be committed. [`backend/.env.example`](backend/.env.example) contains placeholders only, and ignored local paths such as [`backend/secrets`](backend/secrets) and [`backend/backups`](backend/backups) are excluded by [`.gitignore`](.gitignore).

Recommended local pattern:

1. Create an ignored secret directory below the backend workspace.
2. Store the full database connection string in a local file, for example `backend/secrets/database-url.txt`.
3. Reference the file from the environment. `DATABASE_URL_FILE` takes precedence over `DATABASE_URL` when both are set.

```env
DB_PROVIDER=postgresql
DATABASE_URL_FILE=./secrets/database-url.txt
```

Example content of `backend/secrets/database-url.txt` for PostgreSQL:

```text
postgresql://postgres:<password>@localhost:5432/asset_management?schema=public
```

Example content of `backend/secrets/database-url.txt` for SQL Server:

```text
sqlserver://localhost:1433;database=asset_management;user=asset_user;password=<password>;encrypt=true;trustServerCertificate=false
```

Operational guidance:

- Keep secret files readable only by the application/service account. On Windows, restrict access through file properties or `icacls`; on Linux containers/servers, use owner-only permissions such as `600` where applicable.
- Do not copy real `.env` files, secret files, portable backups, native dumps, or screenshots containing connection strings into tickets, commits, logs, or documentation.
- Prefer platform secret managers for production (for example Docker/Kubernetes secrets, CI/CD secret variables, or a managed vault) and mount/inject the value as `DATABASE_URL_FILE` or `DATABASE_URL`.

#### Admin backup/export and import/restore workflow

The Admin UI exposes this workflow under `/admin/database` for system administrators: review safe database metadata, download a portable JSON backup, run an import dry run, or import in append/replace mode. Replace mode requires an explicit confirmation phrase in the UI.

The admin API provides a DBMS-neutral application-data backup format named `asset-management-portable-json-v1` via [`backend/src/services/databaseBackup.service.ts`](backend/src/services/databaseBackup.service.ts). The format contains exported model rows, row counts, source provider metadata, and a SHA-256 checksum. Export redacts credential-like fields such as password hashes, MFA secrets, API token hashes, client secrets, and connector secrets.

All database admin endpoints require authentication and admin access:

```powershell
# Inspect current safe database configuration
Invoke-RestMethod -Method Get `
  -Uri "http://localhost:3001/api/v1/admin/database/config" `
  -Headers @{ Authorization = "Bearer <admin-jwt>" }

# Export a portable JSON backup
Invoke-RestMethod -Method Get `
  -Uri "http://localhost:3001/api/v1/admin/database/export" `
  -Headers @{ Authorization = "Bearer <admin-jwt>" } `
  -OutFile "backend/backups/asset-management-portable-backup.json"

# Validate an import without writing data; verifies checksum and reports row counts
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3001/api/v1/admin/database/import?dryRun=true" `
  -Headers @{ Authorization = "Bearer <admin-jwt>" } `
  -ContentType "application/json" `
  -InFile "backend/backups/asset-management-portable-backup.json"

# Restore by replacing known models first; this is the default mode
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3001/api/v1/admin/database/import?mode=replace" `
  -Headers @{ Authorization = "Bearer <admin-jwt>" } `
  -ContentType "application/json" `
  -InFile "backend/backups/asset-management-portable-backup.json"

# Append rows without clearing existing data; duplicate handling follows Prisma createMany skipDuplicates behavior
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3001/api/v1/admin/database/import?mode=append" `
  -Headers @{ Authorization = "Bearer <admin-jwt>" } `
  -ContentType "application/json" `
  -InFile "backend/backups/asset-management-portable-backup.json"
```

The import endpoint also accepts a multipart file field named `backup`, which is useful for an admin UI or scripted uploads:

```powershell
curl.exe -X POST "http://localhost:3001/api/v1/admin/database/import?dryRun=true" `
  -H "Authorization: Bearer <admin-jwt>" `
  -F "backup=@backend/backups/asset-management-portable-backup.json;type=application/json"
```

Import modes:

- `dryRun=true`: validates the backup format/checksum and returns row counts without database writes.
- `mode=replace`: default restore mode; clears known exported models first, then imports backup rows.
- `mode=append`: imports rows without clearing existing data; intended for carefully planned merge scenarios.

#### DBMS switching and server migration with portable JSON

Use portable JSON export/import when switching between PostgreSQL and Microsoft SQL Server or when moving application data between servers/providers:

1. Start the source environment and confirm `GET /api/v1/admin/database/config` reports the expected provider.
2. Export `GET /api/v1/admin/database/export` and store the file in an ignored backup location such as `backend/backups/`.
3. Provision the target database/server and configure `DB_PROVIDER` plus `DATABASE_URL` or `DATABASE_URL_FILE` for the target.
4. Apply the provider-compatible Prisma schema/client and migrations for the target environment before importing. For SQL Server, run `npm run db:schema:sqlserver --workspace=backend`, `npm run db:generate --workspace=backend`, and the SQL Server migration/deploy commands.
5. Start the target backend and run `POST /api/v1/admin/database/import?dryRun=true`.
6. If validation succeeds, run `POST /api/v1/admin/database/import?mode=replace` for a full restore or `mode=append` for a controlled merge.
7. Recreate secrets that are intentionally redacted from portable backups, such as passwords, MFA secrets, API/service tokens, OIDC client secrets, and integration connector credentials.
8. Verify application health, authentication, critical records, audit logs, and integration configuration after restore.

#### Native dump/restore and SQL Server compatibility notes

Native database backups are provider-specific and not a DBMS-switching format:

- PostgreSQL native dumps (`pg_dump`, `pg_restore`) are suitable for PostgreSQL-to-PostgreSQL restore.
- SQL Server native backups (`BACKUP DATABASE`, `RESTORE DATABASE`, SQL Server Management Studio, or equivalent tooling) are suitable for SQL Server-to-SQL Server restore.
- Native PostgreSQL dumps cannot be restored directly into SQL Server, and SQL Server `.bak` files cannot be restored directly into PostgreSQL.

SQL Server runtime is implemented through the generated provider-specific schema and runtime JSON compatibility layer. Remaining limitations are intentionally narrow: provider-native JSON querying/indexing is not available for fields stored as `NVARCHAR(MAX)` JSON text, and production teams should review generated SQL Server migrations before applying them because SQL Server referential actions are normalized to `NoAction` for compatibility.

---

## Development, Tests, and Build

### Root Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start backend and frontend in parallel |
| `npm run dev:backend` | Start backend in watch mode |
| `npm run dev:frontend` | Start Vite frontend |
| `npm run build` | Run all workspace builds, where available |
| `npm run test` | Run tests in workspaces, where available |
| `npm run lint` | Run linting in workspaces, where available |
| `npm run format` | Run Prettier for TypeScript, JavaScript, and JSON |
| `npm run requirements-check` | Run requirements check script |
| `npm run vulnerability-check` | Run vulnerability/allowlist check script |

### Backend Scripts

| Script | Purpose |
|---|---|
| `npm run dev --workspace=backend` | Start the Express/TypeScript backend with `tsx watch` |
| `npm run build --workspace=backend` | Compile backend TypeScript |
| `npm run start --workspace=backend` | Start the compiled backend from `dist` |
| `npm run test --workspace=backend` | Run Jest tests |
| `npm run lint --workspace=backend` | Run ESLint for backend sources |
| `npm run db:generate --workspace=backend` | Generate Prisma Client |
| `npm run db:deploy --workspace=backend` | Deploy Prisma migrations |
| `npm run db:migrate --workspace=backend` | Run Prisma Migrate Dev (provider-aware via prisma-provider.cjs) |
| `npm run db:validate --workspace=backend` | Validate the provider-selected Prisma schema |
| `npm run db:schema:sqlserver --workspace=backend` | Generate the SQL Server-compatible Prisma schema |
| `npm run db:migrate:sqlserver --workspace=backend` | Generate an initial SQL Server migration for an empty target database |
| `npm run db:deploy:sqlserver --workspace=backend` | Deploy SQL Server migrations with the generated SQL Server schema |
| `npm run db:seed --workspace=backend` | Run seed script |
| `npm run db:seed:demo --workspace=backend` | Run demo seed data script |
| `npm run db:setup:cost-planning --workspace=backend` | Deploy cost-planning-related migrations and generate Prisma Client |

### Frontend and Shared Scripts

| Workspace | Scripts |
|---|---|
| `frontend` | `dev`, `build`, `preview`, `test`, `lint` |
| `shared` | `build`, `clean` |

Recommended quick check after changes:

```powershell
npm run build
npm run test
npm run lint
npm run requirements-check
```

For Prisma/data model changes, additionally run:

```powershell
npm run db:generate --workspace=backend
npm run db:deploy --workspace=backend
```

---

## API and OpenAPI

The API is versioned under `/api/v1`. Registered routes in the backend include, among others:

| Area | Base Path |
|---|---|
| Auth and users | `/api/v1/auth`, `/api/v1/users` |
| Core objects | `/api/v1/assets`, `/api/v1/risks`, `/api/v1/controls`, `/api/v1/incidents` |
| Organization and administration | `/api/v1/organization`, `/api/v1/admin` |
| Audit and evidence | `/api/v1/audit-logs`, `/api/v1/evidence`, `/api/v1/documents` |
| ISMS/Compliance | `/api/v1/frameworks`, `/api/v1/nis2`, `/api/v1/phase6`, `/api/v1/isms-operations`, `/api/v1/catalog` |
| Business objects | `/api/v1/contracts`, `/api/v1/licenses`, `/api/v1/cost-planning` |
| Business processes | `/api/v1/businessprocess` |
| Suppliers | `/api/v1/supplier` |
| Training | `/api/v1/training` |
| Corrective Actions | `/api/v1/corrective-action` |
| Integrations | `/api/v1/intune`, `/api/v1/admin/vmware`, `/api/v1/admin/proxmox`, `/api/v1/imports` |
| Automation | `/api/v1/webhooks`, `/api/v1/service-accounts` |

The OpenAPI specification is located at [`docs/api/openapi.yaml`](docs/api/openapi.yaml). It should be used as the primary reference for documented API contracts and updated whenever API changes are made.

---

## Operations, Security, and Compliance

### Operations

[`docs/operations.md`](docs/operations.md) describes health checks, readiness, metrics, structured logs, correlation IDs, backup/restore, secret rotation, environment separation, graceful shutdown, CI/CD gates, and runbooks. Visible in the code are health endpoints, metrics middleware, JSON logging, correlation ID middleware, and graceful shutdown integration.

### Security

[`docs/security-model.md`](docs/security-model.md) describes security objectives, local authentication, OIDC/Entra ID flows, RBAC, entity-level authorization, admin access protection, audit log, network/CORS requirements, password rules, and data security. The implementation contains middleware and routes for authentication, API scopes, admin functions, audit logs, and OIDC-related flows.

### Compliance Model

[`docs/compliance-matrix.md`](docs/compliance-matrix.md) and [`docs/compliance-matrix.yml`](docs/compliance-matrix.yml) explicitly distinguish between:

- **Application Coverage:** The application technically supports a requirement.
- **Application Requirement Coverage:** The application maps requirements to technical functional coverage.
- **Organization Compliance Assessment:** The organization has implemented controls and can provide evidence.

Status information in the repository should therefore be read as technical project/application coverage, not as organizational certification.

---

## Cost Planning and Fiscal Year Setup

The cost planning module is registered in the backend under `/api/v1/cost-planning` and has its own frontend page, [`frontend/src/pages/CostPlanning.tsx`](frontend/src/pages/CostPlanning.tsx), as well as administrative linkage to fiscal year configuration.

For the local or production-like database, the Prisma migrations must be applied before using the cost planning/fiscal year pages:

```powershell
npm run db:setup:cost-planning --workspace=backend
```

The script runs `prisma migrate deploy` and `prisma generate` in the backend. For production-like environments, `npm run db:deploy --workspace=backend` is sufficient if Prisma Client generation is performed separately. The application should not create or modify cost planning tables from request handlers; if the migration is missing, the API should return a clear setup error instead of an uncaught Prisma table error.

---

## Documentation

| Document | Content |
|---|---|
| [`docs/requirements.md`](docs/requirements.md) | Functional and non-functional requirements, phases, and acceptance criteria |
| [`docs/architecture.md`](docs/architecture.md) | Current/target architecture, backend/frontend structure, data model, security, and API aspects |
| [`docs/operations.md`](docs/operations.md) | Operations manual with health, monitoring, logging, backup/restore, DR, and runbooks |
| [`docs/security-model.md`](docs/security-model.md) | Security model for authentication, authorization, audit, network, and data |
| [`docs/compliance-matrix.md`](docs/compliance-matrix.md) | Human-readable compliance/application coverage matrix |
| [`docs/compliance-matrix.yml`](docs/compliance-matrix.yml) | Machine-readable compliance/application coverage matrix |
| [`docs/api/openapi.yaml`](docs/api/openapi.yaml) | OpenAPI specification |
| [`docs/implementation-log.md`](docs/implementation-log.md) | Implementation and change history |
| [`docs/final-verification-report.md`](docs/final-verification-report.md) | Verification/validation report |
| [`docs/refactoring-plan.md`](docs/refactoring-plan.md) | Refactoring plan |
| [`docs/refactoring-baseline.md`](docs/refactoring-baseline.md) | Baseline for the refactoring state |
| [`docs/repository-assessment.md`](docs/repository-assessment.md) | Repository structure and capability assessment |
| [`docs/vulnerability-allowlist.json`](docs/vulnerability-allowlist.json) | Vulnerability exception allowlist for vulnerability-check script |
| [`docs/baseline-artifacts/`](docs/baseline-artifacts/) | Build, test, lint, and Prisma validation baseline artifacts |
| [`frontend/src/pages/Processes.tsx`](frontend/src/pages/Processes.tsx) | Processes page |
| [`frontend/src/pages/RiskAggregation.tsx`](frontend/src/pages/RiskAggregation.tsx) | Risk aggregation view |

Additional phase-related planning documents are located under [`docs`](docs) and [`plans`](plans).

---

## Roadmap and Project Status

The current project state is phase- and documentation-driven. Requirements and implementation status can be tracked in [`docs/requirements.md`](docs/requirements.md), [`docs/implementation-log.md`](docs/implementation-log.md), [`docs/refactoring-plan.md`](docs/refactoring-plan.md), and the phase-related documents under [`docs`](docs).

For new work:

- First check requirements and acceptance criteria in the existing requirements/planning documents.
- Align API changes with [`docs/api/openapi.yaml`](docs/api/openapi.yaml), backend validation, and shared DTOs.
- Formulate security, operations, and compliance statements only as technical application coverage.
- Run migrations and Prisma Client generation reproducibly through backend scripts.
- Run build, tests, linting, and project-related check scripts before completion where appropriate for the change.

---

## License

This project is proprietary software. All rights reserved.
