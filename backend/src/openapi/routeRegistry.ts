/**
 * Route registry for OpenAPI coverage (Phase 1.5, adjusted scope).
 *
 * This registry is derived exclusively from the router mounts in
 * [`backend/src/index.ts`](backend/src/index.ts:224) — every `app.use('/api/v1/<prefix>', ...)`
 * line has exactly one entry here. It is the single source of truth for the
 * later CI drift check and must never list a prefix that is not registered in
 * `index.ts`.
 *
 * Field semantics (all values are derived from `index.ts`, not from guessing):
 * - `authenticated`: the router is mounted behind `authenticate` at the app level.
 *   Routers that authenticate per route are marked `true` unless the mount is
 *   intentionally public (`auth`, `service-accounts/auth`).
 * - `hasEtag`: `etag()` is mounted for the whole router in `index.ts`.
 * - `hasIdempotency`: `idempotency()` is mounted for the whole router in `index.ts`
 *   (webhooks, service-accounts) or covers the D2 mutation set via per-route
 *   middleware in the router file (assets, tickets, risks, incidents).
 */
export interface RouteRegistryEntry {
  /** Mount path exactly as registered in `index.ts`. */
  path: string;
  /** Router module that owns the mount. */
  module: string;
  /** Router-wide authentication at the app level. */
  authenticated: boolean;
  /** `etag()` mounted app-wide for this router. */
  hasEtag: boolean;
  /** `idempotency()` mounted app-wide or per D2 route in the router file. */
  hasIdempotency: boolean;
  /** Provenance / coverage notes for reviewers and the drift check. */
  notes: string;
}

export const ROUTE_REGISTRY: RouteRegistryEntry[] = [
  {
    path: '/api/v1/auth',
    module: 'authRouter',
    authenticated: false,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Mixed router: login/register/MFA-preauth are public, me/logout/OIDC routes authenticate per route.',
  },
  {
    path: '/api/v1/users',
    module: 'userRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Admin user management; documented via /users/owners plus admin user paths.',
  },
  {
    path: '/api/v1/assets',
    module: 'assetRouter',
    authenticated: true,
    hasEtag: true,
    hasIdempotency: true,
    notes: 'D2 idempotency on POST /assets, POST /assets/bulk-archive, PUT/DELETE /assets/{id} in asset.routes.ts.',
  },
  {
    path: '/api/v1/risks',
    module: 'riskRouter',
    authenticated: true,
    hasEtag: true,
    hasIdempotency: true,
    notes: 'D2 idempotency on POST/PUT/DELETE risk mutations in risk.routes.ts.',
  },
  {
    path: '/api/v1/controls',
    module: 'controlRouter',
    authenticated: true,
    hasEtag: true,
    hasIdempotency: false,
    notes: 'List route sets X-Total-Count via setPaginationHeader.',
  },
  {
    path: '/api/v1/incidents',
    module: 'incidentRouter',
    authenticated: true,
    hasEtag: true,
    hasIdempotency: true,
    notes: 'D2 idempotency on POST/PUT/DELETE incident mutations in incident.routes.ts.',
  },
  {
    path: '/api/v1/tickets',
    module: 'ticketRouter',
    authenticated: true,
    hasEtag: true,
    hasIdempotency: true,
    notes: 'D2 idempotency on POST /tickets and PUT /tickets/{id} in ticket.routes.ts.',
  },
  {
    path: '/api/v1/organization',
    module: 'orgRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Picker routes /units and /scopes; POST /units, POST /scopes and GET /parties return 501 by design.',
  },
  {
    path: '/api/v1/admin',
    module: 'adminRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Admin-only routes authenticate + requireAdminAccess per route.',
  },
  {
    path: '/api/v1/navigation',
    module: 'navigationRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Personal navigation views; all routes authenticate per route.',
  },
  {
    path: '/api/v1/audit-logs',
    module: 'auditLogRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Read-only audit log routes guarded by adminGuard.',
  },
  {
    path: '/api/v1/intune',
    module: 'intuneRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Intune integration; admin access per route.',
  },
  {
    path: '/api/v1/admin/vmware',
    module: 'vmwareRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'VMware integration admin routes; longest-prefix match wins over /admin.',
  },
  {
    path: '/api/v1/admin/proxmox',
    module: 'proxmoxRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Proxmox integration admin routes; longest-prefix match wins over /admin.',
  },
  {
    path: '/api/v1/contracts',
    module: 'contractRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'ISO 27001 Phase 2 domain routes; authenticate per route.',
  },
  {
    path: '/api/v1/licenses',
    module: 'licenseRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'ISO 27001 Phase 2 domain routes; authenticate per route.',
  },
  {
    path: '/api/v1/processes',
    module: 'businessProcessRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Business process routes; authenticate per route.',
  },
  {
    path: '/api/v1/treatments',
    module: 'riskTreatmentRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Risk treatment routes; authenticate per route.',
  },
  {
    path: '/api/v1/methods',
    module: 'riskMethodRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Risk method routes; authenticate per route.',
  },
  {
    path: '/api/v1/imports',
    module: 'importRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Import source/run/conflict routes; authenticate per route.',
  },
  {
    path: '/api/v1/frameworks',
    module: 'frameworkRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Framework/version routes; authenticate per route.',
  },
  {
    path: '/api/v1/evidence',
    module: 'evidenceRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Evidence routes; authenticate per route.',
  },
  {
    path: '/api/v1/documents',
    module: 'documentRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Document lifecycle routes; authenticate per route.',
  },
  {
    path: '/api/v1/knowledge',
    module: 'knowledgeRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Knowledge list is a non-paginated array (no X-Total-Count); routes authenticate per route.',
  },
  {
    path: '/api/v1/nis2',
    module: 'nis2Router',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'NIS2 assessment/registration routes; authenticate per route.',
  },
  {
    path: '/api/v1/phase6',
    module: 'phase6Router',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Generic Phase 6 resource routes; same router instance is also mounted at /api/v1/isms-operations.',
  },
  {
    path: '/api/v1/isms-operations',
    module: 'phase6Router',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Alias mount of phase6Router; documents the generic /{resource} and /{resource}/{id} forms only.',
  },
  {
    path: '/api/v1/action-center',
    module: 'actionCenterRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Action center routes; authenticate per route.',
  },
  {
    path: '/api/v1/catalog',
    module: 'catalogRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Catalog/catalog item routes; authenticate per route.',
  },
  {
    path: '/api/v1/cost-planning',
    module: 'costPlanningRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Cost planning routes; authenticate per route.',
  },
  {
    path: '/api/v1/search',
    module: 'searchRouter',
    authenticated: true,
    hasEtag: true,
    hasIdempotency: false,
    notes: 'Global full-text search with etag() mounted app-wide.',
  },
  {
    path: '/api/v1/webhooks',
    module: 'webhookRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: true,
    notes: 'authenticate + authorize(admin) + idempotency() at the app level.',
  },
  {
    path: '/api/v1/service-accounts/auth',
    module: 'serviceAccountAuthRouter',
    authenticated: false,
    hasEtag: false,
    hasIdempotency: false,
    notes: 'Public POST /auth for service-account token verification; verifies its own credentials.',
  },
  {
    path: '/api/v1/service-accounts',
    module: 'serviceAccountRouter',
    authenticated: true,
    hasEtag: false,
    hasIdempotency: true,
    notes: 'authenticate + authorize(admin) + idempotency() at the app level.',
  },
];
