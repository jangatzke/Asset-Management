# Asset Management ISMS

**IT-Asset-Management und ISMS-System nach ISO 27001:2022, NIS-2 und BSI-Gesetz**

A comprehensive, full-stack IT asset management and Information Security Management System (ISMS) platform designed for ISO 27001:2022 compliance, NIS-2 directive adherence, and BSI regulatory requirements. The system provides end-to-end asset tracking, risk management, incident response, and compliance control capabilities.

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation and Setup](#installation-and-setup)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [API Overview](#api-overview)
- [Data Models](#data-models)
- [Integrations](#integrations)
- [Phase 8 Features](#phase-8-features)
- [Testing](#testing)
- [Multi-language Support](#multi-language-support)
- [Documentation](#documentation)
- [Scripts Reference](#scripts-reference)

---

## Features

### Asset Management
- **34 Asset Types**: Physical servers, VMs, containers, network components, mobile devices, cloud resources, SaaS services, databases, certificates, business processes, and more
- **Asset Relationships**: Directed dependency graph with 12 relationship types (operates_on, communicates_with, uses, contains, etc.)
- **Graph Visualization**: Interactive asset dependency graph with [`AssetGraph`](frontend/src/components/AssetGraph.tsx) component
- **Impact Analysis**: Blast radius calculation along dependency chains via [`AssetImpactAnalysis`](frontend/src/components/AssetImpactAnalysis.tsx)
- **Extended Rating Dimensions**: CIA triad (Confidentiality, Integrity, Availability) plus personnel safety, regulatory relevance, financial damage potential, production downtime impact
- **Lifecycle Tracking**: Full asset lifecycle from planned through disposal with audit logging
- **EOS/EOL/EOS Dates**: End-of-sale, end-of-life, and end-of-support tracking

### Risk Management (ISO 27001 Compliant)
- **Configurable Risk Methods**: Versioned risk assessment methodologies with configurable likelihood/impact scales
- **Risk Assessment**: Asset-based and process-based risk assessment workflows
- **Risk Treatment**: Avoid, reduce, transfer, or accept risk with justification and expiry tracking
- **Risk Aggregation**: Aggregated views by location, organization unit, process, asset type, and ISMS scope
- **Threat & Vulnerability Management**: CVE/CVSS tracking with severity ratings
- **Evidence Linking**: Link evidence to risks for audit compliance

### Incident Management
- **Incident Tracking**: Full incident lifecycle from detection through resolution
- **Impact Assessment**: CIA impact, operational, financial, legal, and personal data impact tracking
- **Notification Deadlines**: NIS-2 compliant notification tracking (early warning, detailed report, final report)
- **Assessment Workflow**: Reportable incident assessment with approval chain

### Contract & License Management
- **Contract Tracking**: Purchase, maintenance, SLA, and support contracts with value and currency
- **License Management**: Perpetual, subscription, and concurrent license tracking with seat counts
- **Renewal Tracking**: Automated renewal date alerts for contracts and licenses

### Business Process Management
- **Process Registry**: Core, supporting, and management process tracking
- **Criticality Mapping**: Link processes to assets, risks, and services
- **SIAC Control**: SIAC-controlled process flagging

### Compliance & Controls
- **Control Catalog**: ISO 27001 Annex A controls with implementation tracking
- **Statement of Applicability**: Framework-based control applicability statements
- **Framework Support**: Multiple compliance framework support (ISO 27001, NIS-2, BSI)
- **Audit Logging**: Complete audit trail for all system actions
- **Audit Management**: Internal and external audit planning, execution, and findings tracking

### Authentication & Authorization
- **OIDC/Entra ID Integration**: Microsoft Entra ID (Azure AD) single sign-on support
- **Role-Based Access Control**: 15 built-in roles (System Admin, ISMS Manager, Asset Owner, Risk Owner, etc.)
- **Group-Based Permissions**: Assign roles to groups for streamlined access management
- **Dual Authentication**: Support for both local password and OIDC authentication

### Integrations
- **Microsoft Intune**: Automatic device and application discovery with scheduled sync
- **VMware vCenter**: Virtual machine discovery and inventory synchronization
- **Proxmox**: Virtual environment integration for VM tracking

### User Experience
- **Multi-language Support**: English and German (i18n) with user-selectable preferences
- **Dark Mode**: User-configurable dark/light theme toggle
- **Responsive UI**: TailwindCSS-based responsive design with Material-UI components

---

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Node.js, Express, TypeScript, Prisma ORM |
| **Database** | PostgreSQL |
| **Frontend** | React 18, TypeScript, Vite |
| **UI Framework** | Material-UI (MUI), TailwindCSS, Headless UI, Heroicons |
| **State Management** | Zustand |
| **Routing** | React Router DOM |
| **Charts** | Recharts |
| **i18n** | react-i18next |
| **Forms** | React Hook Form |
| **HTTP Client** | Axios |
| **Authentication** | JWT, OpenID Connect (openid-client) |
| **Validation** | Zod |
| **Testing** | Jest, ts-jest (backend), Vitest (frontend), Supertest |

---

## Prerequisites

- **Node.js** >= 18.x (LTS recommended)
- **npm** >= 9.x
- **PostgreSQL** >= 14.x
- Optional: **Microsoft Intune** admin access for device sync
- Optional: **VMware vCenter** API access for VM discovery
- Optional: **Proxmox VE** API access for VM discovery

---

## Project Structure

```
asset-management-isms/
├── backend/                    # Backend API server
│   ├── prisma/
│   │   └── schema.prisma      # Database schema and models
│   ├── src/
│   │   ├── index.ts           # Entry point and server setup
│   │   ├── config/            # Database and app configuration
│   │   ├── middleware/        # Auth, error handling, request logging
│   │   ├── routes/            # API route definitions
│   │   ├── services/          # Business logic and integrations
│   │   └── __tests__/         # Backend unit/integration tests
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── App.tsx            # Main app router
│   │   ├── main.tsx           # Entry point
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components (routes)
│   │   ├── context/           # React contexts (i18n, dark mode)
│   │   ├── locales/           # Translation files (en.json, de.json)
│   │   ├── services/          # API client services
│   │   └── store/             # Zustand state management
│   ├── package.json
│   └── vite.config.ts
├── shared/                     # Shared TypeScript types
│   ├── src/
│   │   ├── index.ts           # Type exports
│   │   └── types/             # Domain type definitions
│   │       ├── asset.ts       # Asset, Contract, License types
│   │       ├── common.ts      # Base entity types
│   │       ├── control.ts     # Control and compliance types
│   │       ├── graph.ts       # Graph API types
│   │       └── index.ts       # Type exports
│   └── package.json
├── plan.md                     # ISO 27001 gap analysis document
├── package.json                # Root workspace configuration
└── README.md                   # This file
```

---

## Installation and Setup

### 1. Clone and Install Dependencies

```bash
# Install all workspace dependencies
npm install
```

This installs dependencies for `backend`, `frontend`, and `shared` workspaces simultaneously.

### 2. Database Setup

Ensure PostgreSQL >= 16 is running, then create the database:

```bash
# Create database (adjust credentials as needed)
createdb -U postgres asset_management

# Generate Prisma client
cd backend && npx prisma generate

# Run database migrations
npx prisma migrate dev
```

### 3. Configure Environment Variables

Copy the example environment file and configure:

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your database credentials and configuration (see [Environment Variables](#environment-variables) section).

---

## Environment Variables

Configure the following variables in `backend/.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Backend API server port | `3001` |
| `HOST` | Bind address | `0.0.0.0` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/asset_management?schema=public` |
| `JWT_SECRET` | Secret for JWT token signing | *(required, change in production)* |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | Access token TTL | `1h` |
| `JWT_REFRESH_TOKEN_EXPIRES_IN` | Refresh token TTL | `7d` |
| `CORS_ORIGINS` | Comma-separated allowed CORS origins | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `SESSION_TIMEOUT_MINUTES` | Session timeout | `30` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `10485760` |
| `UPLOAD_DIR` | Upload directory path | `./uploads` |

### Intune Integration (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `INTUNE_ENABLED` | Enable Intune sync (`true`/`false`) | `false` |
| `INTUNE_TENANT_ID` | Microsoft Entra ID tenant ID | — |
| `INTUNE_APP_ID` | Registered app (client) ID | — |
| `INTUNE_CERT_PRIVATE_KEY_SECRET_REF` | SecretStore reference for PEM private key | — |
| `INTUNE_CERT_X5C_SECRET_REF` | SecretStore reference for x5c public cert chain | — |
| `INTUNE_CERT_THUMBPRINT` | Certificate thumbprint | — |
| `INTUNE_APP_NAME` | Display name for synced devices | `Asset-Management` |
| `INTUNE_FULL_SYNC_INTERVAL` | Full sync interval in hours | `24` |
| `INTUNE_INCREMENTAL_SYNC_INTERVAL` | Incremental sync interval in minutes | `120` |
| `INTUNE_GRACE_PERIOD_HOURS` | Grace period before stale/review marking (hours) | `168` |
| `INTUNE_MAX_RETRY_ATTEMPTS` | Max retry attempts for API requests | `3` |
| `INTUNE_RETRY_DELAY_MS` | Base retry delay in milliseconds | `5000` |
| `INTUNE_BATCH_SIZE` | Batch size for sync operations | `100` |

### VMware Integration (Optional)

| Variable | Description |
|----------|-------------|
| `VMWARE_ENCRYPTION_KEY` | AES-256-CBC key (exactly 32 bytes) for encrypting vCenter credentials |

### Webhook Integration (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBHOOK_TIMEOUT_MS` | Outbound webhook timeout in milliseconds | `10000` |
| `WEBHOOK_MAX_RETRIES` | Max retry attempts for failed webhooks | `3` |
| `WEBHOOK_RETRY_DELAY_MS` | Delay between webhook retry attempts (ms) | `5000` |

### Service Account (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVICE_ACCOUNT_PREFIX` | Prefix for generated service account tokens | `svc` |

---

## Running the Application

### Development Mode (Recommended)

Run both backend and frontend simultaneously from the project root:

```bash
# Start both backend and frontend in development mode
npm run dev
```

Or run them separately:

```bash
# Backend only (watch mode with tsx)
npm run dev:backend

# Frontend only (Vite dev server)
npm run dev:frontend
```

- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:3001`
- **Frontend API proxy**: `http://localhost:3000/api` → `http://localhost:3001/api`
- **Health Check (Liveness)**: `http://localhost:3001/health/live`
- **Readiness Probe**: `http://localhost:3001/health/ready`
- **Metrics (Prometheus)**: `http://localhost:3001/metrics`
- **API Feature Flags**: `http://localhost:3001/api-info`

### Production Build

```bash
# Build all workspaces
npm run build

# Start backend in production
cd backend && npm start
```

---

## API Overview

All API endpoints are prefixed with `/api/v1/`.

| Base Path | Resource | Description |
|-----------|----------|-------------|
| `/api/v1/auth` | Authentication | Login, logout, token refresh, OIDC flow |
| `/api/v1/users` | User Management | CRUD operations for users |
| `/api/v1/assets` | Asset Management | Full CRUD, relationships, graph queries |
| `/api/v1/risks` | Risk Management | Risk assessment, treatment, aggregation |
| `/api/v1/controls` | Compliance Controls | Control catalog, implementation tracking |
| `/api/v1/organization` | Organization | Organization units, sites, ISMS scope |
| `/api/v1/incidents` | Incident Management | Incident tracking and assessment |
| `/api/v1/audit-logs` | Audit Trail | Query audit log entries |
| `/api/v1/admin` | Administration | Roles, groups, asset types, OIDC config |
| `/api/v1/contracts` | Contract Management | Contract CRUD and linking to assets |
| `/api/v1/licenses` | License Management | License CRUD and linking to assets |
| `/api/v1/processes` | Business Processes | Business process registry |
| `/api/v1/treatments` | Risk Treatments | Risk treatment plan management |
| `/api/v1/methods` | Risk Methods | Configurable risk assessment methods |
| `/api/v1/intune` | Intune Integration | Device/app sync status and triggers |
| `/api/v1/admin/vmware` | VMware Integration | vCenter server and credential management |
| `/api/v1/admin/proxmox` | Proxmox Integration | Proxmox server and credential management |
| `/api/v1/document` | Document Control | Policy document lifecycle and versioning |
| `/api/v1/evidence` | Evidence Management | Evidence CRUD and audit package export |
| `/api/v1/framework` | Framework Management | Framework import, versioning, control mapping |
| `/api/v1/import` | Import Integration | Integration sources, import runs, field locks |
| `/api/v1/nis2` | NIS-2 Compliance | Questionnaires, applicability assessments, registrations |
| `/api/v1/phase6` | ISMS Phase 6 | Generic resource CRUD, workflows, CAPA, training |
| `/api/v1/service-accounts` | Service Accounts | Token-based service account management |
| `/api/v1/webhooks` | Webhook Management | Outbound webhook configuration and delivery |

---

## Data Models

The database schema is defined in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). Core models include:

### Core Entities

| Model | Description |
|-------|-------------|
| `User` | System users with OIDC support and preferences |
| `Role` | RBAC roles with JSON-based permissions |
| `Group` | User groups for bulk role assignment |
| `OidcConfig` | OIDC/Entra ID configuration |
| `OrganizationUnit` | Hierarchical organization structure |
| `Site` | Physical locations and offices |
| `IsmsScope` | ISMS scope definition per ISO 27001 |

### Asset Management

| Model | Description |
|-------|-------------|
| `Asset` | Core asset entity with 35+ fields |
| `AssetType` | Configurable asset type catalog |
| `AssetRelation` | Directed relationships between assets |
| `Contract` | Contract management with renewal tracking |
| `License` | Software license tracking |
| `Document` | Generic document storage |

### Risk Management

| Model | Description |
|-------|-------------|
| `Risk` | Risk assessment records with CIA ratings |
| `RiskMethod` | Configurable risk calculation methodology |
| `RiskTreatment` | Treatment plans (avoid/reduce/transfer/accept) |
| `Threat` | Threat catalog |
| `Vulnerability` | Vulnerability tracking with CVE/CVSS |
| `Evidence` | Evidence records linked to risks and controls |

### Compliance & Governance

| Model | Description |
|-------|-------------|
| `Control` | Security control implementation tracking |
| `Framework` | Compliance framework definitions |
| `StatementOfApplicability` | SoA for control catalogs |
| `AuditLog` | Complete system audit trail |
| `Audit` | Audit planning and execution |
| `PolicyDocument` | Policy document versioning |

### Incident Management

| Model | Description |
|-------|-------------|
| `Incident` | Security incident tracking |
| `IncidentAssessment` | Reportable incident assessment |
| `NotificationDeadline` | NIS-2 notification deadline tracking |

### Integrations

| Model | Description |
|-------|-------------|
| `IntuneDeviceSync` | Microsoft Intune device synchronization |
| `IntuneDetectedApp` | Detected applications from Intune |
| `IntuneSyncConfig` | Intune sync scheduling configuration |
| `VCenterServer` | VMware vCenter connection configuration |
| `ProxmoxServer` | Proxmox VE connection configuration |
| `ServiceAccount` | Token-based service account credentials |
| `IntegrationSource` | Generic import integration source config |
| `ImportRun` | Import execution tracking |
| `LockField` | Asset field-level import locks |
| `Webhook` | Outbound webhook configuration |
| `WebhookDelivery` | Webhook delivery history |

---

## Integrations

### Microsoft Intune

Automatically discovers and synchronizes managed devices and installed applications from Microsoft Intune via the Graph API.

- **Full Sync**: Complete device inventory refresh (default: every 24 hours)
- **Incremental Sync**: Delta-based updates (default: every 120 minutes)
- **Auto-provisioning**: New devices create asset records automatically
- **Archival**: Devices not seen for 7 days are archived by default

**Setup**: Configure `INTUNE_*` environment variables and register an Entra ID app with `Device.ReadAll` and `DeviceManagementManagedDevices.Read.All` permissions.

### VMware vCenter

Discovers virtual machines from VMware vCenter servers for automatic asset inventory.

- **Multi-server Support**: Connect to multiple vCenter instances
- **Encrypted Credentials**: AES-256-CBC encryption for stored passwords
- **VM Count Tracking**: Per-server VM inventory counts

**Setup**: Set `VMWARE_ENCRYPTION_KEY` (32 bytes) and configure vCenter servers via the admin panel.

### Proxmox VE

Integrates with Proxmox Virtual Environment for VM discovery.

- **API Token or Password Auth**: Supports both authentication methods
- **Node-specific Sync**: Target specific cluster nodes or sync all
- **Encrypted Credentials**: API tokens and passwords stored encrypted

**Setup**: Configure via the admin panel under Admin → Proxmox.

---

## Phase 8 Features

### Correlation IDs
Every request is assigned a unique correlation ID (X-Correlation-ID header) for distributed tracing across the system.

### ETag & Conditional Requests
All resource endpoints support ETag headers with `If-None-Match` / `If-Match` headers for cache-efficient CRUD operations.

### Idempotency
Write endpoints support `Idempotency-Key` header to safely retry requests without side effects.

### Health Checks
Three health endpoints for Kubernetes-compatible orchestration:
- `/health/live` — Liveness probe (process alive)
- `/health/ready` — Readiness probe (DB, dependencies healthy)
- `/metrics` — Prometheus-compatible metrics endpoint

### Structured JSON Logging
All requests and application events are logged as structured JSON via the [`jsonLogger`](backend/src/middleware/jsonLogger.ts) middleware.

### Graceful Shutdown
The server handles `SIGTERM`/`SIGINT` signals, drains active connections, and flushes logs before exit via [`gracefulShutdown`](backend/src/middleware/gracefulShutdown.ts).

---

## Testing

### Backend Tests

The backend uses Jest with ts-jest for TypeScript support:

```bash
cd backend
npm test
```

Test files are located in `backend/src/__tests__/` and cover:
- Authentication service and routes
- Asset graph and impact analysis
- Risk aggregation and treatment
- Contract, license, and business process services
- Admin role and user management
- Authorization and authorization middleware
- OIDC security
- Phase 4/5/6 service tests
- Phase 8 features: correlation-id, ETag, idempotency, health checks, webhook delivery
- Validation middleware
- Route ordering

### Frontend Tests

The frontend uses Vitest for unit testing:

```bash
cd frontend
npm test
```

---

## Multi-language Support

The application supports English and German translations via `react-i18next`.

- **Translation Files**: [`frontend/src/locales/en.json`](frontend/src/locales/en.json) and [`frontend/src/locales/de.json`](frontend/src/locales/de.json)
- **User Preference**: Users can select their preferred language in Settings
- **Context Provider**: [`I18nContext`](frontend/src/context/I18nContext.tsx) manages locale state

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both backend and frontend in development mode |
| `npm run dev:backend` | Start backend only (tsx watch) |
| `npm run dev:frontend` | Start frontend only (Vite) |
| `npm run build` | Build all workspaces |
| `npm run test` | Run tests in all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run format` | Format all files with Prettier |
| `npm run db:migrate` | Run Prisma migrations (backend) |
| `npm run db:generate` | Generate Prisma client (backend) |
| `npm run db:seed` | Seed database (backend) |
| `npm run db:deploy` | Deploy Prisma migrations (backend) |

---

## Documentation

Additional documentation is available in the [`docs/`](docs/) directory:

| File | Description |
|------|-------------|
| [`docs/architecture.md`](docs/architecture.md) | System architecture overview with mermaid diagrams |
| [`docs/operations.md`](docs/operations.md) | Operations manual: health checks, logging, backup, DR |
| [`docs/security-model.md`](docs/security-model.md) | Security model, threat analysis, and controls |
| [`docs/compliance-matrix.md`](docs/compliance-matrix.md) | ISO 27001 / NIS-2 compliance mapping |
| [`docs/compliance-matrix.yml`](docs/compliance-matrix.yml) | Machine-readable compliance matrix |
| [`docs/requirements.md`](docs/requirements.md) | Functional and non-functional requirements |
| [`docs/implementation-log.md`](docs/implementation-log.md) | Development and deployment history |
| [`docs/final-verification-report.md`](docs/final-verification-report.md) | Final verification and validation report |
| [`docs/api/openapi.yaml`](docs/api/openapi.yaml) | OpenAPI 3.1.0 specification |

---

## License

This project is proprietary software. All rights reserved.

---

*Built for ISO 27001:2022 compliance, NIS-2 directive adherence, and BSI regulatory requirements.*
