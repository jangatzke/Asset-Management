# Comprehensive Usability Improvement Recommendations

**Asset Management Application (ISO 27001 Compliance Platform)**

**Date:** 2026-08-01

**Scope:** Full-stack analysis combining frontend UI/UX (React + TypeScript + Tailwind CSS) and backend API (Express + Prisma + Zod) findings.

---

## A. Executive Summary

The Asset Management application is a comprehensive ISO 27001 compliance platform built with a React frontend and Express/Prisma backend. The application demonstrates strong architectural foundations including Zod-based validation, entity-level authorization, i18n support (EN/DE), dark mode, and a well-structured domain model with 30+ entities.

However, several usability gaps directly impact the user experience:

1. **Type Safety Erosion:** All API responses are typed as `Record<string, unknown>` ([`frontend/src/services/api.ts:48`](frontend/src/services/api.ts:48)), forcing manual type checking throughout the frontend.
2. **Inconsistent Error Handling:** Three different error response formats exist across the backend ([`errorHandler.ts`](backend/src/middleware/errorHandler.ts:27), [`validation.ts`](backend/src/middleware/validation.ts:44), [`idempotency.ts`](backend/src/middleware/idempotency.ts:9)), requiring custom error parsing per endpoint.
3. **Missing HTTP Caching:** ETag middleware ([`etag.ts`](backend/src/middleware/etag.ts:43)) and pagination middleware ([`pagination.ts`](backend/src/middleware/pagination.ts:55)) are implemented but never wired to any route.
4. **No Loading State Management:** No optimistic updates or skeleton loaders exist; pages show raw "Loading..." text ([`frontend/src/App.tsx:31`](frontend/src/App.tsx:31)) during route transitions.
5. **Form Validation Gaps:** Required fields are validated client-side but error messages are not associated with specific form fields.
6. **Accessibility Deficiencies:** Canvas-based graph component ([`AssetGraph.tsx`](frontend/src/components/AssetGraph.tsx:65)) has no keyboard navigation or screen reader support.

**Top 3 Priorities:**
- **P0:** Standardize error response format and frontend error handling
- **P0:** Add proper TypeScript types for API responses
- **P1:** Implement loading states and optimistic UI updates

---

## B. Usability Heuristic Evaluation (Nielsen)

### 1. Visibility of System Status

| Rating | Evidence |
|--------|----------|
| **Partial** | Loading states exist but are minimal. The [`Modal`](frontend/src/components/Modal.tsx:11) component has no loading indicator. The [`AssetGraph`](frontend/src/components/AssetGraph.tsx:76) shows error messages but no skeleton during initial load. |

**Findings:**
- [`frontend/src/App.tsx:31`](frontend/src/App.tsx:31): Route fallback shows plain text "Loading..." without spinner
- [`frontend/src/components/AssetGraph.tsx:76`](frontend/src/components/AssetGraph.tsx:76): Loading state is tracked but no visual spinner is rendered in the JSX
- [`frontend/src/pages/Assets.tsx:100`](frontend/src/pages/Assets.tsx:100): Page-level loading state exists but blocks the entire page
- Backend: No `X-Request-ID` header returned to correlate frontend errors with backend logs

**Recommendation:** Implement a centralized loading indicator system with skeleton loaders for list pages and inline spinners for async operations within forms.

### 2. Match Between System and Real World

| Rating | Evidence |
|--------|----------|
| **Good** | Display IDs (ASSET-0001) are used alongside UUIDs. i18n support covers EN/DE. Criticality levels use intuitive labels (low/medium/high/critical). |

**Findings:**
- [`shared/src/dtos/index.ts:63`](shared/src/dtos/index.ts:63): `LifecycleStatusSchema` uses clear state names
- [`shared/src/dtos/index.ts:61`](shared/src/dtos/index.ts:61): `CriticalitySchema` maps to real-world risk terminology
- EntityPicker component ([`frontend/src/components/EntityPicker.tsx:26`](frontend/src/components/EntityPicker.tsx:26)) allows users to search by human-readable labels rather than UUIDs

**Recommendation:** Add human-readable status badges with color coding (e.g., green for "active", yellow for "maintenance") across all list views.

### 3. User Control and Freedom

| Rating | Evidence |
|--------|----------|
| **Partial** | Undo functionality is missing for destructive operations. Archive/Restore exists but no "soft delete" confirmation with recovery window. |

**Findings:**
- [`frontend/src/services/api.ts:136`](frontend/src/services/api.ts:136): Delete operations are immediate with no confirmation dialog visible in the API layer
- [`frontend/src/components/Modal.tsx:11`](frontend/src/components/Modal.tsx:11): Modal supports Escape key to close, but form modals have no "discard changes" warning
- Backend: Archive endpoint ([`frontend/src/services/api.ts:153`](frontend/src/services/api.ts:153)) exists but frontend lacks a "recently deleted" view

**Recommendation:** Implement a toast notification system with "undo" for 5-second window after delete/archive operations.

### 4. Consistency and Standards

| Rating | Evidence |
|--------|----------|
| **Partial** | RESTful patterns are consistent in backend routes, but frontend API response types are inconsistent. Some pages use `response.data.data`, others use `response.data` directly. |

**Findings:**
- [`frontend/src/pages/Assets.tsx:126`](frontend/src/pages/Assets.tsx:126): Uses `response.data?.data` for paginated responses
- [`frontend/src/services/api.ts:134`](frontend/src/services/api.ts:134): Create operations return the created entity directly
- [`frontend/src/services/api.ts:275`](frontend/src/services/api.ts:275): Admin APIs use inconsistent return structures
- Backend: All routes follow consistent Express middleware pattern with `async (req, res, next)`

**Recommendation:** Define a single `ApiResponse<T>` wrapper type and enforce it across all backend routes. Update frontend API layer to consistently unwrap responses.

### 5. Error Prevention

| Rating | Evidence |
|--------|----------|
| **Partial** | Zod validation prevents invalid data at the API level, but frontend forms lack inline field validation. No draft saving for long forms. |

**Findings:**
- [`backend/src/middleware/validation.ts:21`](backend/src/middleware/validation.ts:21): Zod schemas validate all input types
- [`frontend/src/pages/Assets.tsx:191`](frontend/src/pages/Assets.tsx:191): Form validation sets a single `error` string, not field-specific
- No auto-save or draft functionality for complex forms (e.g., Risk creation with 20+ fields)
- [`shared/src/dtos/index.ts:306`](shared/src/dtos/index.ts:306): Deprecated fields use `z.never()` but frontend may still send them

**Recommendation:** Add real-time field-level validation with inline error messages. Implement localStorage-based draft saving for complex forms.

### 6. Recognition Rather Than Recall

| Rating | Evidence |
|--------|----------|
| **Good** | EntityPicker ([`frontend/src/components/EntityPicker.tsx:26`](frontend/src/components/EntityPicker.tsx:26)) eliminates the need to remember UUIDs. Dropdown selects for enums (criticality, lifecycle status). |

**Findings:**
- EntityPicker provides search-as-you-type with label display
- Dropdown selects for enum fields (criticality, lifecycle status, risk treatment options)
- AssetGraph legend ([`frontend/src/components/AssetGraph.tsx:483`](frontend/src/components/AssetGraph.tsx:483)) shows color coding for criticality levels

**Recommendation:** Add tooltips with field descriptions for complex fields (e.g., "mitigationDimension", "riskClasses").

### 7. Flexibility and Efficiency of Use

| Rating | Evidence |
|--------|----------|
| **Partial** | Keyboard shortcuts are not implemented. No bulk operations. EntityPicker has pagination but no keyboard navigation in dropdown. |

**Findings:**
- No keyboard shortcuts for common actions (e.g., `Ctrl+K` for quick search, `Esc` to close modals)
- [`frontend/src/components/EntityPicker.tsx:194`](frontend/src/components/EntityPicker.tsx:194): Dropdown uses buttons (clickable) but no arrow key navigation
- No bulk delete or bulk status update operations
- Pagination exists but no "jump to page" input

**Recommendation:** Implement global keyboard shortcuts and bulk action checkboxes on list tables.

### 8. Aesthetic and Minimalist Design

| Rating | Evidence |
|--------|----------|
| **Good** | Tailwind CSS provides consistent styling. Dark mode is properly implemented. Navigation is clean with icon + label. |

**Findings:**
- [`frontend/src/components/Layout.tsx:114`](frontend/src/components/Layout.tsx:114): Clean navigation with dark mode support
- Tailwind utility classes provide consistent spacing and typography
- Modal component ([`frontend/src/components/Modal.tsx:46`](frontend/src/components/Modal.tsx:46)) has proper visual hierarchy

**Recommendation:** Add subtle animations for state transitions (e.g., modal open/close, toast notifications).

### 9. Help Users Recognize, Diagnose, and Recover from Errors

| Rating | Evidence |
|--------|----------|
| **Poor** | Error messages are generic ("Failed to load graph"). No error codes for support reference. No recovery suggestions. |

**Findings:**
- [`frontend/src/components/AssetGraph.tsx:102`](frontend/src/components/AssetGraph.tsx:102): Error message uses backend message without actionable recovery steps
- [`frontend/src/services/api.ts:88`](frontend/src/services/api.ts:88): API interceptor only handles 401 token refresh; other errors pass through unchanged
- Backend: [`backend/src/middleware/errorHandler.ts:27`](backend/src/middleware/errorHandler.ts:27): Error response includes `message` and `statusCode` but no error code
- No error tracking/integration (e.g., Sentry)

**Recommendation:** Add structured error codes (e.g., `ASSET_NOT_FOUND`, `VALIDATION_FAILED`) and implement a toast notification system with retry buttons.

### 10. Help and Documentation

| Rating | Evidence |
|--------|----------|
| **Poor** | No in-app help, tooltips, or onboarding. OpenAPI spec is incomplete ([`docs/api/openapi.yaml`](docs/api/openapi.yaml:1)). |

**Findings:**
- No help icon or documentation links in the UI
- OpenAPI spec only covers Phase 6 resources, missing 20+ route modules
- No inline form hints for complex fields (e.g., "What is mitigationDimension?")

**Recommendation:** Add a contextual help system with links to documentation. Complete the OpenAPI spec using `@asteasolutions/zod-to-openapi`.

---

## C. Prioritized Action Plan

### P0 — Critical (Implement Immediately)

| # | Recommendation | Description | Frontend Changes | Backend Changes | Effort | Impact | Files |
|---|---------------|-------------|------------------|-----------------|--------|--------|-------|
| P0-1 | **Standardize Error Response Format** | Create unified `ApiError` response schema with error codes | Update API interceptor to parse error codes; implement toast notifications | Add `error.code` to all error responses in `errorHandler.ts` | S | High | [`backend/src/middleware/errorHandler.ts`](backend/src/middleware/errorHandler.ts:1), [`frontend/src/services/api.ts`](frontend/src/services/api.ts:88) |
| P0-2 | **Define API Response Types** | Replace `Record<string, unknown>` with typed response interfaces | Create `AssetApiResponse`, `RiskApiResponse`, etc. in `api.ts`; update all page components | No backend changes needed; just type contracts | S | High | [`frontend/src/services/api.ts:48`](frontend/src/services/api.ts:48) |
| P0-3 | **Implement Toast Notification System** | Replace `alert()` and inline error strings with toast notifications | Create `ToastProvider` component; add `useToast()` hook; replace all `setError()` calls | No backend changes | S | High | New file: `frontend/src/components/ToastProvider.tsx` |
| P0-4 | **Add Loading Skeletons** | Replace "Loading..." text with skeleton loaders for list pages | Create `SkeletonTable` and `SkeletonCard` components; apply to Assets, Risks, Controls pages | No backend changes | M | Medium | Multiple page files |

### P1 — High Priority (Next Sprint)

| # | Recommendation | Description | Frontend Changes | Backend Changes | Effort | Impact | Files |
|---|---------------|-------------|------------------|-----------------|--------|--------|-------|
| P1-1 | **Wire ETag Middleware** | Enable HTTP caching for GET endpoints | Add conditional GET with `If-None-Match` header; handle 304 responses | Wire `etag()` middleware to all GET routes in route files | M | Medium | [`backend/src/middleware/etag.ts`](backend/src/middleware/etag.ts:43) |
| P1-2 | **Wire Pagination Middleware** | Standardize pagination response format and headers | Update pagination UI to use `meta` structure from `paginateResponse()` | Wire `paginate()` middleware to all list routes | M | Medium | [`backend/src/middleware/pagination.ts`](backend/src/middleware/pagination.ts:55) |
| P1-3 | **Add Field-Level Form Validation** | Real-time validation with inline error messages per field | Replace single `error` string with `fieldErrors: Record<string, string>` | No backend changes; validation already exists | M | High | All form pages |
| P1-4 | **Add Undo for Destructive Operations** | 5-second undo window after delete/archive | Add toast with "Undo" button; track last action in context | No backend changes | S | Medium | New context: `frontend/src/context/UndoContext.tsx` |
| P1-5 | **Add Keyboard Navigation to EntityPicker** | Arrow keys + Enter/Escape in dropdown | Add `keydown` handler for dropdown options; track `activeIndex` state | No backend changes | S | Medium | [`frontend/src/components/EntityPicker.tsx`](frontend/src/components/EntityPicker.tsx:1) |

### P2 — Medium Priority (Next Quarter)

| # | Recommendation | Description | Frontend Changes | Backend Changes | Effort | Impact | Files |
|---|---------------|-------------|------------------|-----------------|--------|--------|-------|
| P2-1 | **Add Accessibility to AssetGraph** | Keyboard navigation, ARIA labels, screen reader support for canvas | Add off-screen table with node data; add keyboard handlers (Tab, Enter, Arrow keys) | No backend changes | L | High | [`frontend/src/components/AssetGraph.tsx`](frontend/src/components/AssetGraph.tsx:65) |
| P2-2 | **Implement Bulk Operations** | Checkbox selection + bulk actions (delete, status change, assign) | Add checkbox column to list tables; bulk action toolbar | Add bulk delete/update endpoints | M | Medium | Multiple page files |
| P2-3 | **Add Global Search (Cmd+K)** | Quick search across all entities with keyboard shortcut | Create command palette modal; add `Ctrl+K` / `Cmd+K` listener | Add unified search endpoint or aggregate existing search APIs | M | High | New component: `frontend/src/components/CommandPalette.tsx` |
| P2-4 | **Add Draft Saving for Complex Forms** | Auto-save form data to localStorage; restore on revisit | Add `useDraftForm` hook; auto-save on field change; prompt on unsaved changes | No backend changes | M | Medium | Complex form pages |
| P2-5 | **Add Contextual Help Tooltips** | Hover tooltips explaining complex fields | Add `HelpTooltip` component; add to fields like `mitigationDimension`, `riskClasses` | No backend changes | S | Low | Complex form pages |

### P3 — Low Priority (Backlog)

| # | Recommendation | Description | Frontend Changes | Backend Changes | Effort | Impact | Files |
|---|---------------|-------------|------------------|-----------------|--------|--------|-------|
| P3-1 | **Complete OpenAPI Spec** | Generate OpenAPI from Zod schemas | No frontend changes | Use `@asteasolutions/zod-to-openapi` to generate spec from DTOs | L | Medium | [`shared/src/dtos/index.ts`](shared/src/dtos/index.ts:1), [`docs/api/openapi.yaml`](docs/api/openapi.yaml:1) |
| P3-2 | **Add Rate Limiting Headers** | Show remaining quota to frontend | Parse `X-RateLimit-*` headers; show in settings | Add `express-rate-limit` middleware | S | Low | [`backend/src/middleware/`](backend/src/middleware/) |
| P3-3 | **Add Request Batching** | Batch multiple API calls in single request | Group simultaneous requests; show single loading state | Add `/batch` endpoint | L | Low | [`frontend/src/services/api.ts`](frontend/src/services/api.ts:1) |
| P3-4 | **Add Idempotency Key Support** | Prevent duplicate submissions on network retry | Generate UUID for each mutating request; add `Idempotency-Key` header | No backend changes (middleware exists) | S | Low | [`frontend/src/services/api.ts`](frontend/src/services/api.ts:80) |

---

## D. Quick Wins (Implement This Week)

### DW-1: Standardize Error Response Format

**Issue:** Three different error formats force custom parsing in every frontend component.

**Current State:**
- [`backend/src/middleware/errorHandler.ts:27`](backend/src/middleware/errorHandler.ts:27): `{ success: false, error: { message, statusCode } }`
- [`backend/src/middleware/validation.ts:44`](backend/src/middleware/validation.ts:44): `{ error: 'Validation failed', details: [{ field, message }] }`

**Proposed Unified Format:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [
      { "field": "name", "message": "Name is required" }
    ]
  }
}
```

**Changes Required:**
1. Backend: Update [`errorHandler.ts`](backend/src/middleware/errorHandler.ts:1) to include error codes
2. Backend: Update [`validation.ts`](backend/src/middleware/validation.ts:21) to use unified format
3. Frontend: Update [`api.ts` interceptor](frontend/src/services/api.ts:88) to extract and normalize error codes

**Effort:** Small (2-3 hours)

### DW-2: Add Typed API Response Interfaces

**Issue:** [`frontend/src/services/api.ts:48`](frontend/src/services/api.ts:48) types all responses as `Record<string, unknown>`.

**Changes Required:**
```typescript
// Replace:
export type AssetResponse = Record<string, unknown>;

// With:
export interface AssetResponse {
  id: string;
  displayId: string;
  name: string;
  description?: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  lifecycleStatus: string;
  assetType?: { name: string };
  // ... etc
}
```

**Effort:** Small (1-2 hours per entity type)

### DW-3: Implement Basic Toast Notification System

**Issue:** Error messages are set as component state strings, not visible to users consistently.

**Changes Required:**
1. Create `frontend/src/components/ToastProvider.tsx` with `useToast()` hook
2. Wrap app in `<ToastProvider>` in [`App.tsx`](frontend/src/App.tsx:1)
3. Replace `setError(err.message)` with `toast.error(err.message)` in page components

**Effort:** Small (2-3 hours)

### DW-4: Add Loading Spinner to AssetGraph

**Issue:** [`frontend/src/components/AssetGraph.tsx:76`](frontend/src/components/AssetGraph.tsx:76) tracks `loading` state but no spinner is rendered.

**Changes Required:**
In the JSX section around line 437, add:
```tsx
{loading && (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
)}
```

**Effort:** Small (15 minutes)

### DW-5: Add Error Boundary

**Issue:** Unhandled React errors crash the entire application with a white screen.

**Changes Required:**
Create `frontend/src/components/ErrorBoundary.tsx` and wrap the `<Routes>` in [`App.tsx`](frontend/src/App.tsx:36):
```tsx
<ErrorBoundary fallback={<div>Something went wrong. <button onClick={() => window.location.reload()}>Reload</button></div>}>
  <Routes>...</Routes>
</ErrorBoundary>
```

**Effort:** Small (30 minutes)

---

## E. Medium-Term Improvements (Next Sprint)

### MT-1: Wire ETag Middleware for HTTP Caching

**Current State:** [`backend/src/middleware/etag.ts:43`](backend/src/middleware/etag.ts:43) provides `etag()` middleware but no route uses it.

**Implementation Plan:**
1. Add `etag()` middleware to all GET routes in each route file:
   ```typescript
   import { etag } from '../middleware/etag';
   assetRouter.get('/', etag(), authenticate, ...);
   ```
2. Frontend: Update [`api.ts` interceptor](frontend/src/services/api.ts:80) to handle 304 responses
3. Frontend: Add `If-None-Match` header from cached ETags

**Impact:** Reduced server load, faster page loads for repeated visits

**Files:** All route files in [`backend/src/routes/`](backend/src/routes/), [`frontend/src/services/api.ts`](frontend/src/services/api.ts:80)

**Effort:** Medium (1-2 days)

### MT-2: Implement Field-Level Form Validation

**Current State:** Forms use a single `error` string ([`frontend/src/pages/Assets.tsx:102`](frontend/src/pages/Assets.tsx:102)) displayed at the top.

**Implementation Plan:**
1. Create `frontend/src/hooks/useFormValidation.ts` hook
2. Replace `error` state with `fieldErrors: Record<string, string>`
3. Display inline errors below each invalid field
4. Validate on blur (not on every keystroke) for performance

**Example:**
```typescript
const { errors, validateField, isFieldValid } = useFormValidation({
  name: { required: 'Name is required' },
  assetTypeId: { required: 'Asset type is required' },
});
```

**Files:** All form-containing pages

**Effort:** Medium (2-3 days)

### MT-3: Add Undo for Destructive Operations

**Current State:** Delete operations ([`frontend/src/services/api.ts:136`](frontend/src/services/api.ts:136)) are irreversible.

**Implementation Plan:**
1. Create `frontend/src/context/UndoContext.tsx`
2. After successful delete, show toast with "Undo" button
3. Store deleted item in context for 5 seconds
4. On "Undo", re-post the item and remove from context

**Effort:** Medium (1-2 days)

### MT-4: Add Keyboard Navigation to EntityPicker

**Current State:** [`frontend/src/components/EntityPicker.tsx:194`](frontend/src/components/EntityPicker.tsx:194) dropdown uses buttons with no keyboard navigation.

**Implementation Plan:**
1. Add `activeIndex` state to track selected option
2. Add `keydown` handler: ArrowDown/ArrowUp to navigate, Enter to select, Escape to close
3. Add `aria-activedescendant` for screen reader support

**Effort:** Small (2-3 hours)

### MT-5: Add Skeleton Loaders

**Current State:** [`frontend/src/App.tsx:31`](frontend/src/App.tsx:31) shows "Loading..." during route transitions.

**Implementation Plan:**
1. Create `frontend/src/components/SkeletonTable.tsx`
2. Create `frontend/src/components/SkeletonCard.tsx`
3. Apply to Assets, Risks, Controls, Incidents list pages
4. Replace `loading` state rendering with skeleton components

**Effort:** Medium (1-2 days)

---

## F. Long-Term Architecture Improvements

### LT-1: Accessibility Overhaul for AssetGraph

**Current State:** [`frontend/src/components/AssetGraph.tsx:65`](frontend/src/components/AssetGraph.tsx:65) is a canvas-based visualization with no keyboard or screen reader support.

**Implementation Plan:**
1. Add an off-screen `<table>` with the same node/edge data
2. Add ARIA roles: `role="img"` with `aria-label` on canvas
3. Implement keyboard navigation: Tab to nodes, Enter to select, Arrow keys to pan
4. Add zoom controls as buttons with labels
5. Consider adding an SVG-based alternative for accessibility mode

**WCAG Criteria:** 1.1.1 (Non-text Content), 2.1.1 (Keyboard), 4.1.2 (Name, Role, Value)

**Effort:** Large (3-5 days)

### LT-2: Global Search Command Palette

**Current State:** No unified search across entities. Users must navigate to each page and search individually.

**Implementation Plan:**
1. Create `frontend/src/components/CommandPalette.tsx` (Cmd+K trigger)
2. Search across assets, risks, controls, incidents simultaneously
3. Show quick actions (e.g., "Create new asset", "View risk aggregation")
4. Backend: Add or aggregate existing search endpoints

**Effort:** Large (3-5 days)

### LT-3: Bulk Operations Framework

**Current State:** All operations are single-entity. No bulk delete, bulk status change, or bulk assign.

**Implementation Plan:**
1. Add checkbox column to all list tables
2. Create `frontend/src/components/BulkActionToolbar.tsx`
3. Backend: Add bulk endpoints (`POST /assets/bulk-delete`, `PATCH /assets/bulk-status`)
4. Implement pagination-aware selection

**Effort:** Large (5-7 days)

### LT-4: OpenAPI Auto-Generation

**Current State:** [`docs/api/openapi.yaml`](docs/api/openapi.yaml:1) is incomplete and manually maintained.

**Implementation Plan:**
1. Add `@asteasolutions/zod-to-openapi` to shared package
2. Generate OpenAPI spec from existing Zod schemas in [`shared/src/dtos/index.ts`](shared/src/dtos/index.ts:1)
3. Add route-level OpenAPI decorators
4. Serve Swagger UI at `/api/docs`

**Effort:** Large (3-5 days)

### LT-5: State Management Modernization

**Current State:** Each page manages its own state with `useState`/`useEffect`. No centralized state management.

**Implementation Plan:**
1. Evaluate Zustand vs Jotai for global state
2. Create domain-specific stores (assetStore, riskStore, etc.)
3. Implement request caching and deduplication
4. Add optimistic updates for common operations

**Effort:** Large (5-7 days)

---

## G. Usability Testing Recommendations

### Test Scenario 1: Asset Creation Workflow

**Participants:** 5 ISMS administrators
**Task:** "Create a new server asset with all required fields and assign it to an organization unit"
**Metrics:**
- Time to complete
- Error rate (invalid submissions)
- Satisfaction score (SUS)
**Success Criteria:** < 2 minutes, < 1 error, SUS > 75

### Test Scenario 2: Risk Dependency Analysis

**Participants:** 5 risk analysts
**Task:** "View the dependency graph for a specific asset and identify all upstream dependencies"
**Metrics:**
- Time to identify dependencies
- Accuracy of identification
- User confusion points
**Success Criteria:** 100% accuracy, < 3 minutes

### Test Scenario 3: Bulk Status Update

**Participants:** 5 ISMS administrators
**Task:** "Update the lifecycle status of 10 assets from 'planned' to 'active' simultaneously"
**Metrics:**
- Time to complete vs. individual updates
- Error rate
**Success Criteria:** 50% faster than individual updates, 0 errors

### Test Scenario 4: Error Recovery

**Participants:** 5 users
**Task:** "Submit a risk assessment with invalid data and recover from the error"
**Metrics:**
- Time to diagnose error
- Time to correct and resubmit
- User confidence in recovery
**Success Criteria:** < 1 minute to diagnose, < 2 minutes to recover

### Test Scenario 5: Search and Navigation

**Participants:** 5 users
**Task:** "Find a specific control by keyword and navigate to its details"
**Metrics:**
- Time to find
- Number of clicks
- Use of navigation aids
**Success Criteria:** < 10 seconds, < 3 clicks

---

## H. Accessibility Compliance Checklist (WCAG 2.1 AA)

| Criterion | Current State | Recommendation | Priority |
|-----------|--------------|----------------|----------|
| **1.1.1 Non-text Content** | AssetGraph canvas has no text alternative | Add `aria-label` and off-screen table with node data | P2 |
| **1.3.1 Info and Relationships** | Form labels exist but some fields lack descriptions | Add `<label>` for all inputs; add `aria-describedby` for complex fields | P1 |
| **2.1.1 Keyboard** | AssetGraph only supports mouse | Add keyboard navigation (Tab, Arrow keys, Enter) | P2 |
| **2.1.2 Keyboard Trap** | Modals trap focus correctly (Escape closes) | Verify no keyboard traps in EntityPicker dropdown | P1 |
| **2.4.2 Page Titles** | Each page should have unique title | Verify all route components set `document.title` | P0 |
| **2.4.6 Headers and Labels** | Form labels exist | Verify labels are descriptive and use `aria-label` where needed | P1 |
| **2.4.7 Focus Visible** | Focus ring exists on buttons (`focus:outline-none focus:ring-2`) | Verify focus ring is visible on all interactive elements in both light and dark mode | P1 |
| **3.3.1 Error Identification** | Errors shown as single string at top | Add field-level error identification with `aria-invalid` | P1 |
| **3.3.2 Labels or Instructions** | Form fields have labels | Verify all fields have visible labels; add hints for complex fields | P1 |
| **4.1.2 Name, Role, Value** | Custom components use native elements | Verify EntityPicker options have correct ARIA roles | P1 |
| **1.4.3 Contrast (Minimum)** | Tailwind classes provide contrast | Verify all text meets 4.5:1 contrast ratio in both modes | P0 |
| **1.4.11 Non-text Contrast** | Icons have sufficient contrast | Verify UI component icons meet 3:1 contrast ratio | P0 |
| **1.4.10 Scale Text** | Responsive layout exists | Verify text scales at 200% without overflow | P2 |
| **1.4.12 Text Spacing** | No user-controlled spacing | Consider adding text spacing adjustment in settings | P3 |
| **2.4.1 Bypass Blocks** | Skip navigation not implemented | Add skip-to-content link | P2 |
| **2.4.3 Focus Order** | Tab order follows DOM order | Verify logical tab order in complex forms | P2 |
| **2.4.4 Link Purpose (In Context)** | Navigation links are descriptive | Verify all links have discernible purpose | P0 |
| **3.1.1 Language of Page** | `<html lang>` set by i18n context | Verify language attribute updates on language switch | P0 |
| **3.2.1 On Focus** | Form fields may change on focus | Verify no unexpected behavior on focus | P1 |
| **3.2.2 On Input** | Forms may submit on Enter unexpectedly | Verify Enter key behavior in search fields | P1 |
| **4.1.3 Status Messages** | No ARIA live regions for dynamic updates | Add `aria-live="polite"` for toast notifications | P1 |

---

## Appendix: File Reference Index

### Frontend Files
| File | Purpose | Key Lines |
|------|---------|-----------|
| [`frontend/src/App.tsx`](frontend/src/App.tsx:1) | Route configuration | Lines 31, 36-67 |
| [`frontend/src/components/Layout.tsx`](frontend/src/components/Layout.tsx:1) | Navigation layout | Lines 54-64, 114-254 |
| [`frontend/src/components/AssetGraph.tsx`](frontend/src/components/AssetGraph.tsx:1) | Canvas graph visualization | Lines 65-582 |
| [`frontend/src/components/Modal.tsx`](frontend/src/components/Modal.tsx:1) | Modal dialog | Lines 11-62 |
| [`frontend/src/components/EntityPicker.tsx`](frontend/src/components/EntityPicker.tsx:1) | Entity search/select | Lines 26-220 |
| [`frontend/src/services/api.ts`](frontend/src/services/api.ts:1) | API client layer | Lines 38-52, 80-104 |
| [`frontend/src/context/I18nContext.tsx`](frontend/src/context/I18nContext.tsx:1) | Internationalization | Lines 28-96 |
| [`frontend/src/context/DarkModeContext.tsx`](frontend/src/context/DarkModeContext.tsx:1) | Dark mode toggle | Lines 17-84 |
| [`frontend/src/pages/Assets.tsx`](frontend/src/pages/Assets.tsx:1) | Asset management page | Lines 96-676 |

### Backend Files
| File | Purpose | Key Lines |
|------|---------|-----------|
| [`backend/src/middleware/errorHandler.ts`](backend/src/middleware/errorHandler.ts:1) | Error handling | Lines 1-41 |
| [`backend/src/middleware/validation.ts`](backend/src/middleware/validation.ts:1) | Request validation | Lines 1-75 |
| [`backend/src/middleware/pagination.ts`](backend/src/middleware/pagination.ts:1) | Pagination middleware | Lines 1-170 |
| [`backend/src/middleware/etag.ts`](backend/src/middleware/etag.ts:1) | ETag caching | Lines 1-130 |
| [`backend/src/middleware/idempotency.ts`](backend/src/middleware/idempotency.ts:1) | Idempotency keys | Lines 1-80 |
| [`shared/src/dtos/index.ts`](shared/src/dtos/index.ts:1) | Shared DTO schemas | Lines 1-1375 |

### Documentation Files
| File | Purpose |
|------|---------|
| [`plans/backend-api-ux-analysis.md`](plans/backend-api-ux-analysis.md:1) | Backend API structure analysis |
| [`docs/api/openapi.yaml`](docs/api/openapi.yaml:1) | OpenAPI specification |

---

**Document Version:** 1.0

**Last Updated:** 2026-08-01

**Next Review:** After P0 items are implemented
