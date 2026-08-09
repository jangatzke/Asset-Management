# Browser E2E testing

## Foundation

The browser suite uses [`@playwright/test`](../frontend/package.json) with Chromium, a dedicated Vite port (`3100` by default), trace/screenshot/video artifacts on failure, and automatic local-server startup from [`playwright.config.ts`](../frontend/playwright.config.ts). It does not start Express, Prisma, or a database.

Initial specifications are in [`core-workflows.spec.ts`](../frontend/e2e/core-workflows.spec.ts). They run true browser interactions against the frontend while intercepting only the API contract at the browser boundary. This is deliberate: no dedicated, resettable backend E2E database, credential, or fixture-seeding endpoint currently exists. Fixtures use stable representative data and validate rendering, navigation, request/response orchestration, and mutation refresh without relying on an operator's live database.

Authentication is modeled by browser responses to refresh and current-user endpoints in [`fixtures.ts`](../frontend/e2e/fixtures.ts). The login journey separately exercises the visible form and login response. Do **not** point this suite at production credentials or add test bypasses to production authentication.

## Local Windows commands

From the repository root:

```cmd
npm run e2e --workspace=frontend
npx playwright install chromium --workspace=frontend
npm run build --workspace=frontend
npm run lint --workspace=frontend
```

`npm run e2e --workspace=frontend` starts Vite itself. To reuse an already running frontend, leave `CI` unset and use `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_PORT` if required. CI must install Chromium first and should run `npm ci`, then the four commands above. Reports are emitted to `frontend/playwright-report`; test artifacts are emitted to `frontend/test-results` and are gitignored.

## Initial implemented journeys (4)

1. Login form submission and authenticated dashboard navigation.
2. Action Center visibility, assigned action rendering, and routing to the linked incident.
3. Incident detail NIS2 reportability assessment save and post-mutation refresh.
4. Phase 6 Operations Workspace training entry, seeded course/assignment visibility, and assignment control availability.

## Backlog toward 15–20 journeys

1. Logout and refresh-token expiry redirect.
2. First-administrator bootstrap.
3. MFA challenge/enrolment/password-change pre-auth states.
4. Action Center scope, urgency, source, due-date filters, and pagination.
5. Incident creation, significance calculation, and deadline recalculation.
6. Incident knowledge-time correction and audit trail.
7. Incident report generation/submission/export.
8. Incident communication and closure gating.
9. NIS2 questionnaire through assessment, submit, approve, registration, and registration change.
10. Supplier create, assessment, corrective action, and supplier detail route.
11. BIA/BCP creation, exercise, finding, and CAPA linkage.
12. Audit programme/plan/finding/CAPA lifecycle.
13. Training course assignment, completion, and acknowledgement.
14. Metric threshold breach and Action Center item.
15. Management-review action and approval.
16. Workflow task transition.
17. Report definition/run/export.
18. Role-based access denied/authorized route coverage.

## Blockers for backend-integrated journeys

Promoting the mocked-contract journeys to database-backed E2E requires an isolated database URL, an idempotent seed/reset command, non-production seeded users covering roles/MFA states, and a supported fixture API or equivalent admin setup. Those do not currently exist as an E2E contract. Until then, browser interception is intentionally limited to reliable UI journeys; backend service/integration tests remain the source of truth for persistence and authorization behavior.
