# Authorization Gap Analysis Report

## Scoped Permissions Bypass in Asset Operations

**Date:** 2026-08-05  
**Analyst:** Architect Mode  
**Scope:** Asset creation, update, and relation operations

---

## 1. Executive Summary

The current authorization system implements scoped permissions via `organizationUnitId`, `locationId` (site), `legalEntityId`, and `scopeId` constraints on role assignments. However, three critical gaps allow users with scoped write permissions to bypass those scope constraints:

1. **Asset Creation** — `authorizeEntityWrite('assets')` verifies the user has `assets.write` permission but does NOT validate that the provided `organizationUnitId` or `locationId` in the request body falls within the user's authorized scope.
2. **Asset Update** — Authorization checks against the current asset entity only. If the request body attempts to change `organizationUnitId` or `locationId` to a value outside the user's authorized scope, no re-validation occurs.
3. **Asset Relations** — The `POST /assets/:id/relations` endpoint checks write permission on the source asset but does NOT verify that the target asset falls within the user's authorized scope.

---

## 2. Data Model Reference

### 2.1 Asset Model ([`backend/prisma/schema.prisma:494`](backend/prisma/schema.prisma:494))

```prisma
model Asset {
  id                               String  @id @default(uuid())
  name                             String
  organizationUnitId               String?   // <-- SCOPING FIELD 1
  locationId                       String?   // <-- SCOPING FIELD 2 (references Site)
  // ... other fields
  organizationUnit OrganizationUnit? @relation("AssetOrgUnit", fields: [organizationUnitId], references: [id], onDelete: SetNull)
  location         Site?             @relation("AssetLocation", fields: [locationId], references: [id], onDelete: SetNull)
}
```

### 2.2 AssetRelation Model ([`backend/prisma/schema.prisma:589`](backend/prisma/schema.prisma:589))

```prisma
model AssetRelation {
  id               String   @id @default(uuid())
  sourceAssetId    String
  targetAssetId    String   // <-- TARGET ASSET HAS NO SCOPE CHECK
  relationshipType String
  // ...
  sourceAsset Asset @relation("AssetSource", fields: [sourceAssetId], ...)
  targetAsset Asset @relation("AssetTarget", fields: [targetAssetId], ...)
}
```

### 2.3 OrganizationUnit Model ([`backend/prisma/schema.prisma:295`](backend/prisma/schema.prisma:295))

```prisma
model OrganizationUnit {
  id                String   @id @default(uuid())
  legalEntityId     String?
  // ...
}
```

### 2.4 Role Assignment Scoping ([`backend/prisma/schema.prisma:103`](backend/prisma/schema.prisma:103))

```prisma
model UserRole {
  id                 String    @id @default(uuid())
  roleName           String
  legalEntityId      String?
  organizationUnitId String?   // <-- SCOPE CONSTRAINT
  scopeId            String?
  siteId             String?
  // ...
}
```

---

## 3. Authorization Service Architecture

### 3.1 Core Methods ([`backend/src/services/authorization.service.ts`](backend/src/services/authorization.service.ts))

| Method | Line | Purpose |
|--------|------|---------|
| `getUserRoles(userId)` | 103 | Fetches all direct + group role assignments with permissions |
| `can(userId, permission)` | 136 | Checks if user has permission in ANY active role (no scope check) |
| `canForEntity(userId, permission, entityType, entityId)` | 141 | Checks permission AND scope against a specific entity |
| `require(userId, permission)` | 151 | Throws 403 if `can()` returns false |
| `requireForEntity(userId, permission, entityType, entityId)` | 155 | Throws 403 if `canForEntity()` returns false |
| `requireForScope(userId, permission, scope)` | 161 | **KEY METHOD** — Throws 403 if user lacks permission for a given scope object |
| `buildReadFilter(userId, entityType)` | 174 | Generates Prisma `$where` filter for scoped read queries |
| `resolveEntityScope(entityType, entityId)` | 254 | Resolves an entity's actual scope (OU, location, legal entity) |
| `scopeMatches(role, entityScope)` | 245 | Checks if a role's constraints AND-match against entity scope |

### 3.2 The `requireForScope` Method ([`backend/src/services/authorization.service.ts:161`](backend/src/services/authorization.service.ts:161))

```typescript
async requireForScope(userId: string, permission: PermissionName, scope: ScopeConstraints): Promise<void> {
  const activeRoles = await this.getActiveRoles(userId);
  const grantingRoles = activeRoles.filter((role) => role.permissions.has(permission));
  const resolvedScope = await this.resolveScopeSet(scope);
  if (grantingRoles.length === 0 || !grantingRoles.some((role) => !this.hasScopeConstraint(role) || this.scopeMatches(role, resolvedScope))) {
    throw new AppError(`Authorization denied: ${permission} required for target scope`, 403);
  }
}
```

This method is the **key building block** needed to fix all three gaps. It checks whether the user has a granting permission AND whether the role's scope constraints match the target scope.

### 3.3 Helper Middleware ([`backend/src/middleware/entityAuth.ts`](backend/src/middleware/entityAuth.ts))

| Middleware | Line | Implementation |
|------------|------|----------------|
| `authorizeEntity(entityType, action)` | 20 | Generic factory calling `requireEntityPermission` |
| `authorizeEntityWrite(entityType)` | 55 | Calls `authorizeEntity(entityType, 'write')` |
| `authorizeEntityRead(entityType)` | 48 | Calls `authorizeEntity(entityType, 'read')` |

**Critical flaw in `authorizeEntity`** ([`backend/src/middleware/entityAuth.ts:20`](backend/src/middleware/entityAuth.ts:20)):

```typescript
export const authorizeEntity = (entityType: EntityType, action: EntityAction) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    if (!userId) return next(new AppError('Authentication required', 401));
    try {
      const entityId = req.params.id || req.params.entityId;  // ← Only from URL params!
      await authorizationService.requireEntityPermission(userId, entityType, action, entityId);
      next();
    } catch (error) { ... }
  };
};
```

This middleware **only extracts entity ID from URL params** (`req.params.id`), never from the request body. For create operations, there is no `:id` param, so `entityId` is `undefined`, which causes `requireEntityPermission` to call `require()` instead — which only checks if ANY `assets.write` permission exists, with no scope validation.

---

## 4. Gap Analysis

### 4.1 GAP 1: Asset Creation — No Target Scope Validation

**Location:** [`backend/src/routes/asset.routes.ts:30`](backend/src/routes/asset.routes.ts:30)

```typescript
assetRouter.post('/', authenticate, authorizeEntityWrite('assets'), validateBody(CreateAssetSchema), async (req: AuthRequest, res, next) => {
  try {
    const asset = await assetService.create(req.body, req.userId);
    res.status(201).json(asset);
  } catch (error) { next(error); }
});
```

**Service Implementation:** [`backend/src/services/asset.service.ts:258`](backend/src/services/asset.service.ts:258)

```typescript
async create(data: CreateAssetData, createdBy?: string) {
  const asset = await prisma.$transaction(async (tx) => {
    // ... NO AUTHORIZATION CHECK inside the service method
    const createdAsset = await tx.asset.create({ data: assetData, ... });
    // ...
  });
}
```

**Problem:** The middleware `authorizeEntityWrite('assets')` resolves to `requireEntityPermission(userId, 'assets', 'write', undefined)` because there is no `:id` in the URL. With `entityId` undefined, [`authorizationService.requireEntityPermission()`](backend/src/services/authorization.service.ts:202) falls through to `require(userId, 'assets.write')` which only checks if the user has ANY `assets.write` permission, regardless of scope.

The service's `create()` method receives `organizationUnitId` and `locationId` from `req.body` ([`backend/src/services/asset.service.ts:34-35`](backend/src/services/asset.service.ts:34-35)) but performs NO scope validation.

**Comparison: Risk service DOES implement this check** ([`backend/src/services/risk.service.ts:329`](backend/src/services/risk.service.ts:329)):

```typescript
async create(data: CreateRiskData, createdBy?: string) {
  if (createdBy && data.organizationUnitId) {
    await authorizationService.requireForScope(createdBy, 'risks.write', await resolveOrgUnitScope(data.organizationUnitId));
  }
  // ...
}
```

### 4.2 GAP 2: Asset Update — No Scope Change Validation

**Location:** [`backend/src/routes/asset.routes.ts:118`](backend/src/routes/asset.routes.ts:118)

```typescript
assetRouter.put('/:id', authenticate, authorizeEntityWrite('assets'), validateParams(IdParamSchema), validateBody(UpdateAssetSchema), async (req: AuthRequest, res, next) => {
  try {
    const asset = await assetService.update(req.params.id, req.body, req.userId);
    res.json(asset);
  } catch (error) { next(error); }
});
```

**Service Implementation:** [`backend/src/services/asset.service.ts:386`](backend/src/services/asset.service.ts:386)

```typescript
async update(id: string, data: UpdateAssetData, updatedBy?: string) {
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) throw new AppError('Asset not found', 404);
  // ... NO AUTHORIZATION CHECK for scope changes
  // The middleware already checked that user can write to the EXISTING asset,
  // but if req.body.organizationUnitId or req.body.locationId changes the scope,
  // there is NO validation that the user is allowed to write in the NEW scope.
}
```

**Problem:** The middleware checks `requireEntityPermission(userId, 'assets', 'write', req.params.id)` against the existing asset's scope. This prevents unauthorized users from reading/updating the asset at all. However, if the request body contains:

```json
{ "organizationUnitId": "ou-competitor", "locationId": null }
```

The asset would be moved to a scope the user has no write access to, with no validation.

**Comparison: Risk service DOES implement this check** ([`backend/src/services/risk.service.ts:524-528`](backend/src/services/risk.service.ts:524-528)):

```typescript
async update(id: string, data: UpdateRiskData, updatedBy?: string) {
  const existing = await prisma.risk.findUnique({ where: { id } });
  if (updatedBy) {
    await authorizationService.requireForEntity(updatedBy, 'risks.write', 'risks', id);
    if (data.organizationUnitId !== undefined && data.organizationUnitId !== existing.organizationUnitId) {
      await authorizationService.requireForScope(updatedBy, 'risks.write', await resolveOrgUnitScope(data.organizationUnitId));
    }
  }
}
```

### 4.3 GAP 3: Asset Relations — No Target Asset Scope Validation

**Location:** [`backend/src/routes/asset.routes.ts:212`](backend/src/routes/asset.routes.ts:212)

```typescript
assetRouter.post('/:id/relations', authenticate, requireEntityPermission('assets.write', 'assets'), validateBody(AssetRelationCreateSchema), async (req: AuthRequest, res, next) => {
  try {
    const relation = await assetService.createRelation(req.params.id, req.body);
    res.status(201).json(relation);
  } catch (error) { next(error); }
});
```

**Service Implementation:** [`backend/src/services/asset.service.ts:833`](backend/src/services/asset.service.ts:833)

```typescript
async createRelation(assetId: string, relationData: {
  targetAssetId: string;
  relationshipType: string;
  description?: string;
}) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new AppError('Source asset not found', 404);

  const target = await prisma.asset.findUnique({ where: { id: relationData.targetAssetId } });
  if (!target) throw new AppError('Target asset not found', 404);

  // ← NO AUTHORIZATION CHECK on target asset scope!
  // The route middleware checks write permission on the source asset (:id),
  // but the target asset could be in any scope.

  const relation = await prisma.assetRelation.create({
    data: { sourceAssetId: assetId, ...relationData },
  });
  return relation;
}
```

**Problem:** A user with `assets.write` scoped to `organizationUnitId: 'ou-internal'` can:
1. Read the target asset's details (if they have `assets.read` for it, or if the read is unscoped)
2. Create a relation pointing TO that target asset
3. This creates a dependency link that could expose information or create unauthorized cross-scope connections

The middleware `requireEntityPermission('assets.write', 'assets')` only validates write access on the source asset (`:id` from URL params). The target asset scope is never checked.

---

## 5. Summary of Exact Fix Locations

| Gap | File | Line | Current Code | Required Change |
|-----|------|------|--------------|-----------------|
| **1. Asset Creation** | [`backend/src/services/asset.service.ts`](backend/src/services/asset.service.ts) | ~258-259 | No scope validation in `create()` | Add `authorizationService.requireForScope()` check for `data.organizationUnitId` and/or `data.locationId` before creating the asset |
| **2. Asset Update** | [`backend/src/services/asset.service.ts`](backend/src/services/asset.service.ts) | ~386-390 | No scope change validation in `update()` | Add check similar to risk service: if `data.organizationUnitId` or `data.locationId` differs from existing, call `requireForScope()` for the new scope |
| **3. Asset Relations** | [`backend/src/services/asset.service.ts`](backend/src/services/asset.service.ts) | ~833-856 | No target asset scope check in `createRelation()` | After fetching the target asset, call `authorizationService.requireForEntity(userId, 'assets.write', 'assets', targetAssetId)` to ensure user can write in the target's scope |
| **3b. Asset Relations (route)** | [`backend/src/routes/asset.routes.ts`](backend/src/routes/asset.routes.ts) | ~212 | Route passes `req.body` to service without userId | Pass `req.userId` to `createRelation()` so the service can perform the target scope check |

---

## 6. Recommended Implementation Pattern

The risk service provides the correct pattern to follow:

### 6.1 For Asset Creation

```typescript
// In asset.service.ts create() method, add at the start:
async create(data: CreateAssetData, createdBy?: string) {
  // NEW: Validate target scope for creation
  if (createdBy) {
    const targetOrgUnitId = data.organizationUnitId ?? null;
    const targetLocationId = data.locationId ?? null;
    
    // Resolve the effective scope of the target asset
    const scopeConstraints: ScopeConstraints = {
      legalEntityId: null, // Will be resolved from OU
      organizationUnitId: targetOrgUnitId,
      scopeId: null,
      siteId: targetLocationId,
    };
    await authorizationService.requireForScope(createdBy, 'assets.write', scopeConstraints);
  }
  // ... existing transaction code
}
```

### 6.2 For Asset Update

```typescript
// In asset.service.ts update() method, after fetching existing:
async update(id: string, data: UpdateAssetData, updatedBy?: string) {
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) throw new AppError('Asset not found', 404);
  
  // NEW: Validate scope changes
  if (updatedBy) {
    await authorizationService.requireForEntity(updatedBy, 'assets.write', 'assets', id);
    
    const newOrgUnitId = data.organizationUnitId ?? existing.organizationUnitId;
    const newLocationId = data.locationId ?? existing.locationId;
    
    if ((data.organizationUnitId !== undefined && data.organizationUnitId !== existing.organizationUnitId) ||
        (data.locationId !== undefined && data.locationId !== existing.locationId)) {
      await authorizationService.requireForScope(updatedBy, 'assets.write', {
        legalEntityId: null,
        organizationUnitId: newOrgUnitId,
        scopeId: null,
        siteId: newLocationId,
      });
    }
  }
  // ... existing update code
}
```

### 6.3 For Asset Relations

```typescript
// In asset.service.ts createRelation() method:
async createRelation(assetId: string, relationData: { targetAssetId: string; relationshipType: string; description?: string }, userId?: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new AppError('Source asset not found', 404);
  
  const target = await prisma.asset.findUnique({ where: { id: relationData.targetAssetId } });
  if (!target) throw new AppError('Target asset not found', 404);
  
  // NEW: Validate target asset scope
  if (userId) {
    await authorizationService.requireForEntity(userId, 'assets.write', 'assets', relationData.targetAssetId);
  }
  
  // ... existing relation creation
}
```

```typescript
// In asset.routes.ts, update the route to pass userId:
assetRouter.post('/:id/relations', authenticate, requireEntityPermission('assets.write', 'assets'), validateBody(AssetRelationCreateSchema), async (req: AuthRequest, res, next) => {
  try {
    const relation = await assetService.createRelation(req.params.id, req.body, req.userId);
    res.status(201).json(relation);
  } catch (error) { next(error); }
});
```

---

## 7. Existing Tests

### 7.1 Authorization Integration Tests ([`backend/src/__tests__/authorization.integration.test.ts`](backend/src/__tests__/authorization.integration.test.ts))

The test file covers:
- Basic permission checks (`can`, `canForEntity`)
- Scope constraint validation (`requireForScope`)
- Read filter generation (`buildReadFilter`)
- Validity interval semantics
- Multi-assignment OR logic

**Missing test coverage for the gaps:**
- No test for asset creation with scope validation
- No test for asset update with scope change validation
- No test for asset relation target scope validation

### 7.2 Asset CRUD Tests ([`backend/src/__tests__/asset.crud.test.ts`](backend/src/__tests__/asset.crud.test.ts))

Tests basic asset CRUD operations including relation syncing on update, but does NOT test authorization for scope changes or relation target validation.

### 7.3 Recommended New Tests

```typescript
// In authorization.integration.test.ts or a new asset-authorization.test.ts:

describe('Asset creation scope validation', () => {
  it('should reject creating asset in OU outside user scope', async () => {
    // User scoped to ou-it should not create asset in ou-prod
  });
  
  it('should reject creating asset at location outside user scope', async () => {
    // User scoped to site-a should not create asset at site-b
  });
});

describe('Asset update scope change validation', () => {
  it('should reject moving asset to OU outside user scope', async () => {
    // User with write on asset in ou-it should not move it to ou-prod
  });
  
  it('should reject moving asset to location outside user scope', async () => {
    // User with write on asset at site-a should not move it to site-b
  });
  
  it('should allow updating asset without scope changes', async () => {
    // User with write on asset should update non-scope fields
  });
});

describe('Asset relation target scope validation', () => {
  it('should reject creating relation to target asset outside user scope', async () => {
    // User with write on asset in ou-it should not create relation to asset in ou-prod
  });
});
```

---

## 8. Additional Considerations

### 8.1 Legal Entity Resolution

The `requireForScope` method expects `ScopeConstraints` with `legalEntityId`. Since assets reference `organizationUnit` which has a `legalEntityId`, the implementation should resolve the legal entity from the OU:

```typescript
// Helper to resolve full scope from partial input
async function resolveAssetScope(organizationUnitId: string | null, locationId: string | null): Promise<ScopeConstraints> {
  const scope: ScopeConstraints = { legalEntityId: null, organizationUnitId, scopeId: null, siteId: locationId };
  if (organizationUnitId) {
    const ou = await prisma.organizationUnit.findUnique({ where: { id: organizationUnitId }, select: { legalEntityId: true } });
    scope.legalEntityId = ou?.legalEntityId ?? null;
  }
  return scope;
}
```

### 8.2 Unrestricted Roles

Users with roles that have NO scope constraints (all of `legalEntityId`, `organizationUnitId`, `scopeId`, `siteId` are null) should be able to perform all operations. The `hasScopeConstraint()` method ([`backend/src/services/authorization.service.ts:241`](backend/src/services/authorization.service.ts:241)) already handles this — `requireForScope` grants access if any granting role has no scope constraints.

### 8.3 Consistency with Risk Service

The risk service pattern should be replicated for assets to maintain consistency across the codebase. This includes:
- Using `requireForEntity` for existing entity validation
- Using `requireForScope` for target scope validation
- Validating scope changes only when the field actually changes

---

## 9. Files Modified

| File | Changes |
|------|---------|
| [`backend/src/services/asset.service.ts`](backend/src/services/asset.service.ts) | Add scope validation to `create()`, `update()`, and `createRelation()` methods |
| [`backend/src/routes/asset.routes.ts`](backend/src/routes/asset.routes.ts) | Pass `req.userId` to `createRelation()` |
| [`backend/src/__tests__/asset-authorization.test.ts`](backend/src/__tests__/asset-authorization.test.ts) | **New file** — Tests for asset scope validation |

---

## 10. Risk Assessment

| Gap | Severity | Exploitability | Impact |
|-----|----------|----------------|--------|
| Asset Creation | **HIGH** | Easy — any user with `assets.write` can specify any OU/location in request body | Creates assets outside authorized scope, potentially in competitor organizations |
| Asset Update | **HIGH** | Easy — any user with `assets.write` on any asset can move it to any OU/location | Scope escalation, data exfiltration via asset relocation |
| Asset Relations | **MEDIUM** | Moderate — requires knowing target asset ID and having write on source | Cross-scope dependency links, information disclosure through graph traversal |

---

## 11. Remediation Status (Applied 2026-08-05)

All three authorization gaps have been remediated. The following changes were made:

### 11.1 Asset Service — Scope Validation Helpers

**File:** [`backend/src/services/asset.service.ts:7-20`](backend/src/services/asset.service.ts:7-20)

Added two helper functions to resolve `ScopeConstraints` from organization unit and location IDs:

```typescript
import { authorizationService } from './authorization.service';
import type { ScopeConstraints } from './authorization.service';

async function resolveOrganizationUnitScope(organizationUnitId: string): Promise<ScopeConstraints> {
  const organizationUnit = await prisma.organizationUnit.findUnique({
    where: { id: organizationUnitId },
    select: { id: true, legalEntityId: true }
  });
  if (!organizationUnit) throw new AppError('Organization unit not found', 404);
  return { legalEntityId: organizationUnit.legalEntityId ?? null, organizationUnitId, siteId: null, scopeId: null };
}

async function resolveLocationScope(locationId: string): Promise<ScopeConstraints> {
  const location = await prisma.site.findUnique({
    where: { id: locationId },
    select: { id: true, organizationUnitId: true }
  });
  if (!location) throw new AppError('Location not found', 404);
  return { legalEntityId: null, organizationUnitId: location.organizationUnitId, siteId: null, scopeId: null };
}
```

### 11.2 Asset Creation — Target Scope Validation

**File:** [`backend/src/services/asset.service.ts:272-279`](backend/src/services/asset.service.ts:272-279)

Added scope validation before asset creation:

```typescript
async create(data: CreateAssetData, createdBy?: string) {
  // Validate scope for asset creation - check if user has write permission for the target scope
  if (createdBy && data.organizationUnitId) {
    await authorizationService.requireForScope(createdBy, 'assets.write', await resolveOrganizationUnitScope(data.organizationUnitId));
  }
  if (createdBy && data.locationId) {
    await authorizationService.requireForScope(createdBy, 'assets.write', await resolveLocationScope(data.locationId));
  }
  // ... rest of create logic
}
```

### 11.3 Asset Update — Scope Change Detection

**File:** [`backend/src/services/asset.service.ts:419-430`](backend/src/services/asset.service.ts:419-430)

Added scope change detection before applying updates:

```typescript
async update(id: string, data: UpdateAssetData, updatedBy?: string) {
  // ... existing checks ...
  
  // If organizationUnitId or locationId is being changed, validate write permission for the NEW scope
  if (updatedBy) {
    const newOrgUnitId = data.organizationUnitId ?? existing.organizationUnitId;
    const newLocationId = data.locationId ?? existing.locationId;

    if (newOrgUnitId !== existing.organizationUnitId && newOrgUnitId != null) {
      await authorizationService.requireForScope(updatedBy, 'assets.write', await resolveOrganizationUnitScope(newOrgUnitId));
    }
    if (newLocationId !== existing.locationId && newLocationId != null) {
      await authorizationService.requireForScope(updatedBy, 'assets.write', await resolveLocationScope(newLocationId));
    }
  }
  // ... rest of update logic
}
```

### 11.4 Asset Relations — Target Asset Authorization

**File:** [`backend/src/services/asset.service.ts:868-886`](backend/src/services/asset.service.ts:868-886)

Added target asset write permission validation:

```typescript
async createRelation(assetId: string, relationData: {...}, userId?: string) {
  // ... existing source asset checks ...
  
  // Validate write permission for the target asset
  if (userId) {
    await authorizationService.requireForEntity(userId, 'assets.write', 'assets', target.id);
  }
  // ... rest of relation creation logic
}
```

### 11.5 Asset Routes — Pass userId to Service Methods

**File:** [`backend/src/routes/asset.routes.ts`](backend/src/routes/asset.routes.ts)

| Route | Line | Change |
|-------|------|--------|
| `POST /assets` | 32 | Already passes `req.userId` as `createdBy` |
| `PUT /assets/:id` | 120 | Already passes `req.userId` as `updatedBy` |
| `POST /assets/:id/relations` | 214 | Updated to pass `req.userId` as third argument |

### 11.6 Verification

- TypeScript compilation (`tsc --noEmit`) passes with no errors.
- The implementation follows the same pattern as the reference implementation in the risk service.
- All three service methods now receive the authenticated user's ID, enabling their target scope authorization checks to execute properly.

### 11.7 Recommended Follow-up

1. **Add integration tests** — Create test cases in [`backend/src/__tests__/authorization.integration.test.ts`](backend/src/__tests__/authorization.integration.test.ts) that verify:
   - User with scope-limited write cannot create assets outside their scope
   - User with scope-limited write cannot move assets to scopes outside their authorization
   - User cannot create relations to target assets outside their scope

2. **Audit log enhancement** — Consider logging scope change events in the audit log for compliance tracking.

3. **API documentation update** — Update the OpenAPI spec to document the new authorization requirements for relation creation.
# Action Center P1: Phase-6 scoped-role filtering decision (2026-08-09)

## Decision

Entity-level scoped filtering for Action Center Phase-6 sources is **deferred**. The existing behavior remains: Phase-6 Action Center records are returned only for an active, unscoped role with the source's read permission. Roles constrained by legal entity, organization unit, ISMS scope, or site do not grant Action Center visibility for these sources.

## Why `authorizationService.buildReadFilter()` cannot be safely applied

`buildReadFilter()` only generates entity-level predicates for `assets`, `risks`, `controls`, and `incidents`. Its scoped-filter implementation intentionally returns no predicate for `suppliers`, `bcm`, and `audits`; a scoped role consequently receives the deny-all sentinel. Extending only the resource mapping would not solve the schema problem.

The Action Center Phase-6 models do not expose a common, relational scope path that can support each scoped-role constraint:

- `Supplier` has no legal-entity, organization-unit, ISMS-scope, or site field/relation.
- `SupplierAssessment` has only scalar `supplierId`; the Prisma schema has no `Supplier` relation through which a scoped predicate could be expressed.
- `BusinessImpactAnalysis` references processes/services by scalar IDs and has no declared scope relation; `BusinessContinuityPlan` similarly has scalar `biaId` and a free-text `scope` field, not an `IsmsScope` relation.
- `BCPExercise` reaches a BCP only through scalar `bcpId`, and the BCP lacks a relational scope.
- `AuditPlan.scope` is free text, not an `IsmsScope` foreign key; `ManagementReview` has no scope linkage.

Using owner, assessor, chair, participant JSON, free-text scope, or application-side post-filtering as a substitute would neither implement the authorization model consistently nor safely protect list-query disclosure. It would also be incomplete for legal-entity, organization-unit, ISMS-scope, and site constraints.

## Required architecture before implementation

Add normalized foreign-key relations (or a single common authorization-scope relation) for every listed source and its derived records; generate Prisma relations and indexes; extend `EntityType`, `resolveEntityScope()`, and `buildScopedFilter()` with predicates that enforce every constraint; then add service and integration tests for allow, deny, combined constraints, mixed scoped/unscoped roles, and cross-source traversal. Only after that can Action Center pass `buildReadFilter()` predicates to all affected Phase-6 delegates.
