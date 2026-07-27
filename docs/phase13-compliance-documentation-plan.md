# Phase 13: Correct Compliance Documentation Model

**Date:** 2026-07-27  
**Preceded by:** Phase 12 (enforce CI/CD release gates) — commit `0daa75c`  
**Not started:** Phase 14

## Problem Statement

The compliance documentation across the Asset Management workspace conflates **application technical capability** with **organizational ISO 27001/NIS-2 compliance**. This creates false compliance claims that could mislead auditors, stakeholders, and regulatory reviewers.

### Specific Issues Identified

1. **`docs/compliance-matrix.yml`**: Uses `status: compliant` for every requirement, implying the organization is fully compliant when these entries only document application feature coverage.
2. **`docs/compliance-matrix.md`**: Title references "ISO 27001" and uses legacy status terms (`compliant`, `non_compliant`, `missing`) without distinguishing application capability from organizational compliance.
3. **`docs/final-verification-report.md`**: Contains an "ISO 27001:2022 Compliance Assessment" section (lines 130-158) claiming A.5 through A.9 compliance based solely on software features (e.g., "Training awareness through role-based access" for A.6).
4. **`README.md`**: Claims the system is "nach ISO 27001:2022, NIS-2 und BSI-Gesetz" compliant and labels Risk Management as "ISO 27001 Compliant".
5. **No documentation consistency test** enforces the corrected terminology or matrix structure.

## Documentation Model Correction

### Two-Dimension Framework

All compliance documentation MUST distinguish between two dimensions:

| Dimension | Question | Who Answers | Evidence Type |
|-----------|----------|-------------|---------------|
| **Application Coverage** | Can the application technically support this requirement? | Development/Engineering | Code, tests, API docs |
| **Organization Compliance Assessment** | Has the organization implemented the control and can provide evidence? | Compliance/Legal/Audit | Policies, procedures, training records, audit reports |

### Corrected Status Terms

| Status Term | Meaning | Dimension |
|-------------|---------|-----------|
| `implemented` | Application code exists and passes tests for this requirement | Application Coverage |
| `tested` | Application feature has automated test coverage | Application Coverage |
| `evidence-capable` | Application can generate/export data that supports organizational evidence collection | Application Coverage |
| `partial` | Application partially implements the requirement | Application Coverage |
| `manual evidence required` | Application cannot automate evidence; organization must collect manually | Organization Compliance |
| `organizational control` | This is purely an organizational/process control, not an application feature | Organization Compliance |
| `not applicable to application` | Requirement does not apply to the software product itself | Both |

### Forbidden Wording

The following terms MUST NOT appear in compliance documentation when referring to the organization:

- "ISO 27001 compliant" (when claiming organizational compliance)
- "compliant with ISO 27001"
- "fully compliant"
- "meets ISO 27001 requirements"
- Any statement implying the **organization** has achieved certification or audit clearance

Permitted usage: "Application Requirement Coverage for ISO 27001:2022 controls" — describing which application features map to which control requirements.

## Files to Modify

| File | Action |
|------|--------|
| `docs/phase13-compliance-documentation-plan.md` | **NEW** — This plan document |
| `docs/compliance-matrix.yml` | Replace `status: compliant` with corrected statuses; add dimension labels |
| `docs/compliance-matrix.md` | Rewrite title and legend; split into Application Coverage vs Organization Compliance sections |
| `docs/requirements.md` | Remove ISO 27001 compliance claims from title/header; clarify these are application requirements |
| `docs/final-verification-report.md` | Remove "ISO 27001:2022 Compliance Assessment" section (A.5-A.9); replace with Application Coverage Summary |
| `README.md` | Replace "nach ISO 27001:2022 compliance" with "Application Requirement Coverage for ISO 27001:2022" |
| `backend/src/__tests__/phase0.docs-consistency.test.ts` | Add tests for forbidden wording and matrix structure |

## Verification Steps

1. Run docs consistency test (new) — must pass
2. Run `npm run requirements-check` — must pass  
3. Verify no forbidden wording remains in compliance docs
4. Backend build, Prisma validate, backend tests if feasible
5. Frontend build/tests if feasible

## Commit Message

```
Phase 13: correct compliance documentation model
```

## Out of Scope

- Phase 14 and beyond are NOT started
- No code-quality or architecture cleanup
- No new modules or features
- No changes to application logic, API endpoints, or database schema
