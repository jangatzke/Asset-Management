# Phase 14: Code Quality and Architecture Plan

## Status
Final implementation phase before verification.

## Baseline Assessment

### TypeScript Build Status
- **Backend**: Clean build (no errors). Old `tsc_errors.txt` entries (`Request` unused import in `entityAuth.ts`, `authorizeEntityRead` unused in `asset.routes.ts`) are already resolved in current codebase.
- **Frontend**: Clean build (no errors).

### Large Components Identified
| File | Lines | Risk |
|------|-------|------|
| `frontend/src/pages/ISMSPhase6.tsx` | 1043+ | High - monolithic page with inline modals, resource metadata, search, CRUD |
| `frontend/src/pages/Risks.tsx` | 709 | Medium-High - multiple modals, complex state, nested risk control workflows |
| `frontend/src/pages/Controls.tsx` | 556 | Medium - catalog selection, implementation management, linked risks display |

### Legacy/Deprecated Markers Found
1. **Route alias**: `/isms-phase6` redirects to `/isms-operations` (App.tsx:46) - compatibility redirect for old bookmarks
2. **Backend route alias**: `/api/v1/isms-operations` aliases `phase6Router` alongside `/api/v1/phase6` (index.ts:183)
3. **Legacy permission mapping**: `LEGACY_ENTITY_PERMISSION_MAP` in authorization.service.ts - used during migration, still active for backward compatibility
4. **Deprecated risk fields**: `Risk.existingControls`, `Control.relatedRiskIds` - rejected by validation but schema fields remain
5. **Placeholder endpoints**: Asset import (501), org scopes/party listing (501) - intentional stubs

### Code Quality Observations
- Multiple `any` types in API service calls and risk control assessment forms
- Repeated status color mapping logic across Risks.tsx, Controls.tsx, ISMSPhase6.tsx
- Inline form handling in large pages could be extracted to custom hooks

## Phase 14 Scope (Code Quality Only)

### Work Item 1: Extract shared status helpers
**File**: `frontend/src/utils/statusHelpers.ts` (new)
**Source**: Repeated `getRiskColor`, `getStatusColor` patterns across Risks.tsx, Controls.tsx
**Action**: Create shared helper with standardized risk/control status color mapping. Update touched pages to use the shared function.

### Work Item 2: Extract risk control workflow helpers from Risks.tsx
**File**: `frontend/src/pages/riskControlWorkflow.utils.ts` (extend existing)
**Action**: Move `riskControlEffectivenessTranslationKey`, `controlVerificationLabel` logic, and related formatters to the shared utils file. The file already exists per environment - extend it with additional helpers.

### Work Item 3: Reduce unsafe `any` in Risks.tsx
**File**: `frontend/src/pages/Risks.tsx`
**Action**: 
- Replace `err: any` in catch blocks with proper error typing using `unknown` + type guards
- Type the `riskDetails` Record more precisely
- Document remaining `any` exceptions

### Work Item 4: Remove obsolete legacy route alias (safe)
**File**: `backend/src/index.ts`, `frontend/src/App.tsx`
**Action**: 
- Remove `/isms-phase6` redirect route in frontend (old URL no longer needed after multiple releases)
- Keep backend `/api/v1/isms-operations` alias for API backward compatibility

### Work Item 5: Improve asset.routes.ts structure
**File**: `backend/src/routes/asset.routes.ts`
**Action**: Remove unused import if present. The file currently imports `requireAdminAccess` which is used, so no changes needed here.

### Work Item 6: Update tsc_errors.txt baseline
**File**: `backend/tsc_errors.txt`
**Action**: Clear stale error entries since builds are clean.

## Exclusions (Out of Scope)
- No new ISMS modules or business features
- No broad cosmetic changes to UI
- No removal of active routes or tests
- No Prisma schema changes
- No architecture restructure beyond file extraction

## Verification Checklist
- [ ] Backend TypeScript build passes (`npx tsc --noEmit`)
- [ ] Shared package builds
- [ ] Frontend TypeScript build passes
- [ ] Prisma validate/status clean
- [ ] Full backend Jest suite passes
- [ ] Frontend tests pass
- [ ] Workspace lint clean
- [ ] Requirements-check script passes

## Commit Message
```
Phase 14: improve code quality and architecture
```
