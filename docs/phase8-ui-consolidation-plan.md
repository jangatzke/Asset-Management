# Phase 8: UI Consolidation Plan

## Overview

Phase 8 consolidates entity selection UI across the frontend, replacing raw UUID inputs with reusable `EntityPicker` components and replacing raw JSON textareas with structured UI forms. This phase focuses on improving UX for ISMS Phase 6 entities while maintaining backend permissions as the authoritative access control mechanism.

## Goals

1. **Reusable EntityPicker Component**: Build a generic entity picker supporting search, pagination, multi-select, debounce, and display of ID/name/title across all entity types with API endpoints.
2. **Replace Raw UUID Inputs**: Remove manual UUID entry from normal user workflows in ISMSPhase6.tsx (BIA Owner ID, Auditor IDs, BCP Owner ID, CAPA Owner ID, Training Course/User IDs, Management Review Chair ID, Metrics Owner ID).
3. **Structured JSON Replacement**: Replace Security Requirements JSON textarea with structured list UI for suppliers.
4. **Risk Detail Tabs**: Add tab structure for Risk detail page (Overview, Assessment, Controls, Treatment, Evidence, History, Audit).
5. **i18n Compliance**: No new hardcoded UI text; all texts moved to `en.json` and `de.json`.

## Affected Files

### New Files
- `frontend/src/components/EntityPicker.tsx` - Reusable entity picker component
- `frontend/src/pages/RiskDetail.tsx` - Risk detail page with tabs
- `frontend/src/services/entityPickerApi.ts` - API helpers for EntityPicker endpoints

### Modified Files
- `frontend/src/pages/ISMSPhase6.tsx` - Replace raw UUID inputs with EntityPicker, structured Security Requirements
- `frontend/src/locales/en.json` - Add i18n entries for new UI text
- `frontend/src/locales/de.json` - Add German translations
- `frontend/src/services/api.ts` - Add entity search API helpers if needed
- `docs/requirements.md` - Update requirements to reflect Phase 8 changes
- `docs/compliance-matrix.yml` - Update compliance matrix
- `docs/implementation-log.md` - Log Phase 8 implementation

### Test Files
- `frontend/src/components/EntityPicker.test.tsx` - EntityPicker component tests
- `frontend/src/pages/RiskDetail.test.tsx` - Risk detail tab tests

## Entity Types Supported by EntityPicker

| Entity Type | API Endpoint | Label Field | Search Support |
|-------------|-------------|-------------|----------------|
| user | `/users/search?q=` | email / name | Yes |
| asset | `/assets?q=` | displayId + name | Yes |
| organizationUnit | `/organization/units?q=` | name | Yes |
| legalEntity | (via assets) | name | Limited |
| site | (via assets) | name | Limited |
| businessProcess | (phase6Api) | name/title | Via API |
| businessService | (phase6Api) | name/title | Via API |
| supplier | phase6Api.suppliers | legalName | Yes |
| risk | `/risks?q=` | displayId + title | Yes |
| control | `/controls?q=` | displayId + title | Yes |
| controlImplementation | (via controls) | implementationStatus | Limited |
| evidence | `/evidence` | id | Limited |

## EntityPicker Component API

```tsx
interface EntityPickerProps {
  label: string;                    // Displayed via i18n key
  entityType: EntityType;           // Type of entity to search
  value?: EntityOption | null;      // Single select value
  values?: EntityOption[];          // Multi-select values
  onChange?: (value: EntityOption) => void;   // Single select handler
  onValuesChange?: (values: EntityOption[]) => void; // Multi-select handler
  multiple?: boolean;               // Enable multi-select
  placeholder?: string;             // i18n key for placeholder
  required?: boolean;               // Show required indicator
  disabled?: boolean;               // Disable picker
}

type EntityType = 
  | 'user' | 'asset' | 'organizationUnit' 
  | 'supplier' | 'risk' | 'control'
  | 'businessProcess' | 'businessService'
  | 'legalEntity' | 'site'
  | 'evidence';
```

## ISMSPhase6.tsx Changes

### Fields Replaced with EntityPicker

| Resource | Field | Old Type | New Type | Multi-Select |
|----------|-------|----------|----------|-------------|
| bias (BIA) | ownerId | text (UUID) | EntityPicker (user) | No |
| bias (BIA) | businessProcesses | text (comma IDs) | EntityPicker (businessProcess) | Yes |
| bias (BIA) | resources | text (comma IDs) | EntityPicker (asset) | Yes |
| bias (BIA) | dependencies | text (comma IDs) | EntityPicker (supplier) | Yes |
| bcps (BCP) | ownerId | text (UUID) | EntityPicker (user) | No |
| auditPlans | auditorIds | text (comma IDs) | EntityPicker (user) | Yes |
| correctiveActions | ownerId | text (UUID) | EntityPicker (user) | No |
| trainingAssignments | courseId | text (UUID) | EntityPicker (supplier) | No |
| trainingAssignments | userId | text (UUID) | EntityPicker (user) | No |
| managementReviews | chairId | text (UUID) | EntityPicker (user) | No |
| metricDefinitions | ownerId | text (UUID) | EntityPicker (user) | No |

### Security Requirements Structured UI

Replace the `securityRequirements` JSON textarea with a structured list:
- Each requirement has: `id`, `category`, `description`, `status`
- Add/remove rows UI
- Stored as array of objects in backend (same format, better UX)

## Risk Detail Page

New page at `/risks/:riskId` with tabs:
1. **Overview** - Basic risk info (title, description, status, scores)
2. **Assessment** - Inherent/Current/Target assessment versions
3. **Controls** - Linked controls and effectiveness
4. **Treatment** - Treatment plans and actions
5. **Evidence** - Associated evidence documents
6. **History** - Assessment/version history
7. **Audit** - Audit trail

## i18n Keys Added

```json
{
  "entityPicker": {
    "searchPlaceholder": "Search...",
    "noResults": "No results found",
    "scrollForMore": "Scroll for more...",
    "loading": "Loading...",
    "selectedCount": "{count} selected"
  },
  "entityTypes": {
    "user": "User",
    "asset": "Asset",
    "organizationUnit": "Organization Unit",
    "supplier": "Supplier",
    "risk": "Risk",
    "control": "Control"
  },
  "ismsOperations.fields": {
    "ownerId": "Owner",
    "auditorIds": "Auditors",
    "chairId": "Chair",
    "courseId": "Course",
    "businessProcesses": "Business Processes",
    "resources": "Resources",
    "dependencies": "Dependencies"
  },
  "securityRequirements": {
    "title": "Security Requirements",
    "addRequirement": "Add Requirement",
    "category": "Category",
    "description": "Description",
    "status": "Status",
    "categories": ["Confidentiality", "Integrity", "Availability", "Compliance", "Operational"]
  },
  "riskDetail": {
    "overview": "Overview",
    "assessment": "Assessment",
    "controls": "Controls",
    "treatment": "Treatment",
    "evidence": "Evidence",
    "history": "History",
    "audit": "Audit"
  }
}
```

## Testing Strategy

1. **EntityPicker Unit Tests**: Test search, debounce, multi-select, pagination, keyboard navigation
2. **ISMSPhase6 Regression Tests**: Verify org picker still works after EntityPicker integration
3. **Structured JSON Tests**: Verify Security Requirements structured form saves correctly
4. **Risk Detail Tab Tests**: Verify tab switching and data loading

## Verification Checklist

- [ ] Backend build (`npm run build`) passes
- [ ] Shared package build passes
- [ ] Frontend build (`npm run build`) passes
- [ ] Prisma validate passes
- [ ] Prisma status shows no pending migrations
- [ ] Backend Jest tests pass (514/514)
- [ ] Frontend Vitest tests pass
- [ ] ESLint passes on new files
- [ ] No raw UUID inputs in ISMSPhase6.tsx workflows
- [ ] All new UI text uses i18n keys

## Known Limitations

- EntityPicker pagination depends on API support; some endpoints may only support basic search
- Evidence and controlImplementation entity types have limited search support via existing APIs
- Risk detail page shows existing data only (no full CRUD for all tabs) - Phase 9+ will expand capabilities
- No new ISMS fachmodule added in this phase

## Commit Message

```
Phase 8: consolidate entity selection UI

- Add reusable EntityPicker component with search, multi-select, debounce
- Replace raw UUID inputs in ISMSPhase6.tsx workflows
- Replace Security Requirements JSON textarea with structured list UI
- Add Risk detail page with tab structure (Overview, Assessment, Controls, Treatment, Evidence, History, Audit)
- Add i18n entries for all new UI text (en.json, de.json)
- Add frontend tests for EntityPicker, structured JSON, Risk detail tabs
```
