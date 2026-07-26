# Technical Consolidation and Hardening Refactoring Plan

## Mandatory per-phase workflow

Every phase must use this workflow before moving to the next phase:

1. Re-read the current baseline and relevant requirements.
2. Inspect the existing implementation before changing code.
3. Define the exact file scope for the phase.
4. Make the smallest necessary change set for that phase only.
5. Run available verification commands for affected backend, frontend, shared, Prisma, tests, lint and CI workflow checks.
6. Update requirements, compliance matrix and implementation log with evidence and known gaps.
7. Create a phase-specific commit containing only the phase changes.
8. Stop if verification exposes unrelated pre-existing defects; document them instead of broadening scope.

## Ordered phases

### Phase 0 - Reproducible technical baseline

- Document current scripts, builds, tests, Prisma validation, migration status, lint and CI/CD workflow.
- Add traceable requirements for the consolidation work packages.
- Add only lightweight documentation/requirements consistency coverage if appropriate.
- Do not implement functional refactoring.

### Phase 1 - Authorization consolidation

- Consolidate administrative and entity-level authorization decision paths.
- Verify admin capability checks, entity permission levels and route ordering.
- Do not add new ISMS product modules.

### Phase 2 - Authentication and OIDC hardening

- Harden local auth bootstrap, self-registration, auth rate limiting and OIDC state/nonce/PKCE behavior.
- Ensure failures are audited without leaking secrets.

### Phase 3 - MFA and password pre-auth hardening

- Implement MFA/password pre-auth requirements only after Phase 2 is stable.
- Keep privileged-action checks explicit and auditable.

### Phase 4 - Audit and DTO/API contract consolidation

- Consolidate audit logging for security-relevant flows.
- Align shared DTOs and backend validation contracts.

### Phase 5 - Frontend/security-flow alignment and operations gate

- Align UI behavior with consolidated auth/authz/DTO outcomes.
- Update operational documentation and verification evidence.
- Stop after Phase 5 for explicit review and approval before any later work.

## Mandatory stop after Phase 5

After Phase 5, no Phase 6 or later work may start automatically. The repository must have a documented review of requirements, changed files, schema/API/UI changes, tests, known remaining items and a decision record authorizing any next phase.

### Phase 6 - Reserved pending post-gate decision

No work in this consolidation run.

### Phase 7 - Reserved pending post-gate decision

No work in this consolidation run.

### Phase 8 - Reserved pending post-gate decision

No work in this consolidation run.

### Phase 9 - Reserved pending post-gate decision

No work in this consolidation run.

### Phase 10 - Reserved pending post-gate decision

No work in this consolidation run.

### Phase 11 - Reserved pending post-gate decision

No work in this consolidation run.

### Phase 12 - Reserved pending post-gate decision

No work in this consolidation run.

### Phase 13 - Reserved pending post-gate decision

No work in this consolidation run.

### Phase 14 - Reserved pending post-gate decision

No work in this consolidation run.
