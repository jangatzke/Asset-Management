# Organization Units Admin and Control Implementation Plan

> **Status update (2026-10-30):** Implemented, with two open items. Evidence in the current codebase:
> - **Admin CRUD** — `listOrganizationUnits`, `createOrganizationUnit` (duplicate-name check among non-archived units), `updateOrganizationUnit`, `archiveOrganizationUnit` and an additional `restoreOrganizationUnit` exist in [`admin.service.ts`](backend/src/services/admin.service.ts:1339). Routes `GET/POST /api/v1/admin/organization-units`, `PUT /:id`, `POST /:id/archive`, `POST /:id/restore`, plus extra picker endpoints `GET /search` and `GET /:id`, are registered with `authenticate` + `requireAdminAccess` in [`admin.routes.ts`](backend/src/routes/admin.routes.ts:725).
> - **Picker endpoint kept** — `GET /api/v1/organization/units` still serves non-archived units with `?q=` search for normal workflows ([`organization.routes.ts`](backend/src/routes/organization.routes.ts:13)); `POST /organization/units` remains a 501 stub, as described in "Current findings".
> - **Frontend client + Admin page** — `adminApi.*OrganizationUnit*` methods exist in [`api.ts`](frontend/src/services/api.ts:814); [`AdminOrganizationUnits.tsx`](frontend/src/pages/AdminOrganizationUnits.tsx) is implemented and registered at `/admin/organization-units` in [`App.tsx`](frontend/src/App.tsx:116) and the admin navigation in [`Layout.tsx`](frontend/src/pages/../components/Layout.tsx:368).
> - **Controls selector replaced** — step 7 is done: [`Controls.tsx`](frontend/src/pages/Controls.tsx:453) uses `searchOrganizationUnits` (via `organizationApi.listUnits`) with `EntitySearchSelect`; the raw text input is gone. The same pattern was also applied to Assets and Risks pages.
> - **Open items:** step 8 (including `organizationUnit: { id, name }` in control list/detail includes) is NOT implemented — [`control.service.ts`](backend/src/services/control.service.ts:182) still includes only `findings`/`actions` per implementation. Step 9 tests for the Admin org-unit routes/service were not added (no matching test files found).
> - **Deviations:** create/update accept only `name`, `description`, `parentId`, `type` — `legalEntityId` and `responsibleUserId` are not exposed in the Admin CRUD API, consistent with the plan's "keep legalEntityId optional" decision. Archiving performs no reference checks against users/sites/assets/risks/roles/control implementations (step 1's reference-check proposal was not implemented); archive is soft (`isArchived: true`) and reversible via restore.

## Scope

- Make organization units maintainable in the Admin area.
- Replace the raw Control Implementation organization unit ID input with a searchable selector.
- Reuse the existing organization unit model, picker endpoint, and frontend entity search components where possible.
- Do not address unrelated asset tree-view or draft warning issues.

## Current findings

### Data model

- Organization units already exist in Prisma as OrganizationUnit with fields for name, description, parentId, type, legalEntityId, responsibleUserId, isArchived, createdAt, updatedAt, createdBy, and updatedBy.
- ControlImplementation already has nullable scopeId, organizationUnitId, and siteId relations, including a ControlImplementation to OrganizationUnit relation.
- No schema migration is required for the core requirement unless stricter uniqueness or additional fields are desired.

### Backend API

- The public authenticated picker endpoint GET /api/v1/organization/units is implemented and returns items shaped as id, label, and name.
- POST /api/v1/organization/units currently returns 501 and is not suitable for Admin CRUD.
- Admin CRUD patterns already exist under /api/v1/admin for asset types and business processes using admin routes plus admin service methods.
- Control implementation creation already validates that a target scope exists, requires either scopeId, organizationUnitId, or siteId, verifies organization unit existence, and checks controls.write authorization against the resolved scope.
- Control list/detail responses include implementations but do not include organizationUnit details today, so the frontend cannot show a friendly selected label for existing implementations unless backend includes it or the frontend refetches it.

### Frontend

- Controls page uses a raw text input for implementationForm.organizationUnitId.
- Risks page already uses organizationApi.listUnits with EntitySearchSelect for organization unit selection.
- A generic EntityPicker and entityPickerApi also support organizationUnit, but Controls already uses EntitySearchSelect for responsible user, so EntitySearchSelect is the smaller local change.
- Admin navigation and routing have established patterns for adding a new page beside AdminAssetTypes, AdminUsers, etc.
- Localization currently labels controls.fields.organizationUnitId as Organization Unit ID / Organisationseinheit-ID; this should become user-facing Organization Unit / Organisationseinheit for the selector.

## Recommended implementation steps

1. Add backend organization unit Admin CRUD in admin.service.ts:
   - listOrganizationUnits with optional archived and search support.
   - createOrganizationUnit validating non-empty unique name, optional description, type, parentId, legalEntityId, responsibleUserId.
   - updateOrganizationUnit with duplicate-name protection and relationship existence checks.
   - archiveOrganizationUnit or deleteOrganizationUnit with reference checks for users, sites, assets, risks, roles, and control implementations.

2. Add /api/v1/admin/organization-units routes in admin.routes.ts:
   - GET /organization-units.
   - POST /organization-units.
   - PUT /organization-units/:id.
   - POST /organization-units/:id/archive or DELETE /organization-units using safe archive-first behavior.
   - Protect all routes with authenticate and requireAdminAccess.

3. Keep GET /api/v1/organization/units as the reusable picker endpoint:
   - Exclude archived organization units by default.
   - Optionally select parent/legalEntity display data for better labels.
   - Do not require Admin access, because normal workflows need searchable organization unit selection.

4. Update API client methods in frontend services:
   - Extend organizationApi or adminApi with organization unit list/create/update/archive methods.
   - Keep organizationApi.listUnits for picker/search behavior.

5. Add AdminOrganizationUnits.tsx:
   - Follow AdminAssetTypes style for search, table/card list, create/edit modal, success/error messaging, dark mode classes, and i18n.
   - Fields: name, description, type, parent organization unit, legal entity, responsible user, archived status display.
   - For parent/responsible user use EntitySearchSelect or EntityPicker; legal entity has no current picker endpoint discovered, so either defer legalEntityId input/selection or add a simple legal-entity picker endpoint if in scope.

6. Register the Admin page:
   - Add lazy import and route /admin/organization-units in App.tsx.
   - Add navigation entry in Layout.tsx adminSubPages.
   - Add en/de locale keys for navigation and AdminOrganizationUnits text.

7. Replace Controls raw organizationUnitId input:
   - Change implementation form state from organizationUnitId string to organizationUnitOption object plus payload mapping to organizationUnitId.
   - Add a searchOrganizationUnits function reusing organizationApi.listUnits, mirroring Risks.tsx.
   - Render EntitySearchSelect for organization unit in the create implementation modal.
   - Require organizationUnitOption.id for create if the product decision remains that organization unit is mandatory, or preserve backend flexibility and allow scope/site in future.

8. Improve control implementation response shape if needed:
   - Include organizationUnit, site, and scope in control implementation list/detail includes so selected and listed implementations can display labels instead of IDs.
   - At minimum include organizationUnit: { id, name }.

9. Add/update tests:
   - Backend route/service tests for Admin organization unit list/create/update/archive and picker filtering.
   - Frontend tests or smoke coverage for Controls create implementation payload mapping from selected organization unit option to organizationUnitId.
   - Locale key test updates for newly added translation keys.

## Risks and decisions

- Deletion should likely be archive-only because organization units are referenced by users, roles, assets, risks, sites, and control implementations.
- OrganizationUnit name uniqueness is currently not enforced by Prisma; implement service-level duplicate checks first, and consider a later migration only if global uniqueness is required.
- ControlImplementationSchema currently accepts only UUID organizationUnitId, while other schemas use EntityIdSchema for demo IDs. If seeded demo organization units use deterministic IDs in this workflow, change ControlImplementationSchema to EntityIdSchema for consistency.
- LegalEntity admin support exists in the schema but no current admin route/page was found; keep legalEntityId optional or add a small picker/API only if required for organization unit maintenance.
