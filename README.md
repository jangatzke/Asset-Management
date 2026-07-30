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

- Backend API with Express, TypeScript, Prisma ORM, and PostgreSQL.
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
| Database | PostgreSQL |
| Frontend | React 18, TypeScript, Vite |
| UI | Material UI, Tailwind CSS, Headless UI, Heroicons |
| Routing/State | React Router DOM, Zustand |
| Forms/i18n/Charts | React Hook Form, react-i18next, Recharts |
| HTTP/Validation/Auth | Axios, Zod, JWT, OpenID Connect |
| Tests | Jest, ts-jest, Supertest, Vitest |
| Tooling | npm Workspaces, ESLint, Prettier, TypeScript |

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
- PostgreSQL for local development and tests against a real database.
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
| Base | `NODE_ENV`, `HOST`, `PORT`, `DATABASE_URL` | Runtime, network binding, and database connection |
| Auth/Sessions | `JWT_SECRET`, token lifetimes, pre-auth/MFA configurations | Local authentication, JWTs, session/refresh flows |
| CORS/HTTP | `CORS_ORIGINS`, rate limit options, upload limits | Browser access, API hardening, and request limits |
| Monitoring | `METRICS_TOKEN`, log/health-related variables | Access to metrics and operational observability |
| Integrations | `INTUNE_*`, `VMWARE_ENCRYPTION_KEY`, Proxmox/webhook/SMTP-related variables | External systems and background jobs |

Details on operational variables and production considerations are available in [`docs/operations.md`](docs/operations.md) and [`docs/security-model.md`](docs/security-model.md).

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
| `npm run db:migrate --workspace=backend` | Run Prisma Migrate Dev |
| `npm run db:seed --workspace=backend` | Run seed script |
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
