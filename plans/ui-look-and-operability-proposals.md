# UI: Look & Operability Proposals

**Asset Management Application (ISO 27001 / NIS2 Compliance Platform)**

**Date:** 2026-09-10

**Scope:** Two concrete, high-impact proposals for *look* ("Optik") and two for *operability* ("Bedienbarkeit"), each grounded in the current frontend code (`frontend/src`). These are intentionally a focused complement to the broader audit in [`plans/usability-improvement-recommendations.md`](plans/usability-improvement-recommendations.md), which covers type-safety, error-format standardization, and caching. The proposals below target only the two experience dimensions the user asked about.

**Method:** Each proposal states the current state (with line references), the concrete change, and the effort/impact so a reviewer can triage quickly.

---

## Part A — Optik (Look)

### Proposal A1 — Introduce a design-token layer and replace ad-hoc Tailwind color literals with semantic tokens

**Current state (problem)**
Colors, radii, and spacing are scattered as raw literals across every page:
- Primary action color is duplicated as `bg-blue-600 dark:bg-blue-500` in [`Assets.tsx:508`](frontend/src/pages/Assets.tsx:508), `Tickets.tsx:69`(frontend/src/pages/Tickets.tsx:69), and many others.
- Status colors are re-declared inline per component (e.g. criticality badges in [`Assets.tsx:605`](frontend/src/pages/Assets.tsx:605), ticket badges in [`Tickets.tsx:12`](frontend/src/pages/Tickets.tsx:12)) with slightly different palettes, so "red" means "critical" in one place and "closed" in another.
- The dashboard uses `text-primary-600` ([`Dashboard.tsx:103`](frontend/src/pages/Dashboard.tsx:103)) while list pages use `text-blue-600`, giving the app an inconsistent brand identity.

**Proposal**
1. Extend [`frontend/tailwind.config.js`](frontend/tailwind.config.js) with a semantic token map instead of raw brand colors: `primary`, `primary-content`, `danger`, `warning`, `success`, `muted`, plus `radius` scale and `spacing` scale.
2. Create small shared style-string constants (a pattern already present in [`Assets.tsx:59-60`](frontend/src/pages/Assets.tsx:59) and [`Dashboard.tsx:32`](frontend/src/pages/Dashboard.tsx:32)) in a new `frontend/src/styles/tokens.ts` module, e.g. `buttonPrimary`, `badgeCritical`, `badgeStatusClosed`.
3. Replace the inline literals in the two most visible surfaces (Dashboard metric cards and the Assets list) first, then roll out.

**Impact / Effort**
- Impact: High — instant visual consistency, easier dark-mode tuning, single source of truth for the brand color.
- Effort: Medium — config change + refactor of ~15–20 color literals; safe because the classes are plain strings and covered by the existing e2e suite (`frontend/e2e/core-workflows.spec.ts`).

---

### Proposal A2 — Add a lightweight, consistent status/criticality badge system across all list views

**Current state (problem)**
Status representation is inconsistent and sometimes ambiguous:
- Criticality uses colored pills in the Assets table ([`Assets.tsx:605`](frontend/src/pages/Assets.tsx:605)) but the Assets "status" column renders a **plain text** value ([`Assets.tsx:614`](frontend/src/pages/Assets.tsx:614)) — lifecycle states like `maintenance`, `isolated`, `decommissioned` are unreadable at a glance.
- Ticket badges ([`Tickets.tsx:12`](frontend/src/pages/Tickets.tsx:12)) reuse the red/orange/green palette for entirely different meanings (priority vs. closed), so a reader cannot trust that "red = bad".
- The Dashboard ([`Dashboard.tsx:25`](frontend/src/pages/Dashboard.tsx:25)) defines its own priority classes again.

**Proposal**
1. Build one shared badge component, e.g. `frontend/src/components/StatusBadge.tsx`, that maps a `(kind, value)` pair to a single, consistent palette: `criticality` (low→green … critical→red) and `state` (active→green, in-progress→amber, closed→slate). Keep meaning stable across modules (red always = critical/high, never = "closed").
2. Replace the inline criticality pills and the plain-text Assets status with the badge; convert ticket status/priority to the same system.
3. Ensure each badge carries an accessible label via `title`/`aria-label` and meets WCAG text contrast in both themes.

**Impact / Effort**
- Impact: High — a user scanning the Assets list or Tickets list reads risk at a glance and stops misreading "red = closed".
- Effort: Low–Medium — one shared component, then swap out the three inline implementations; unit-testable via the existing Vitest setup.

---

## Part B — Bedienbarkeit (Operability)

### Proposal B1 — Add global keyboard navigation and a command palette for primary actions

**Current state (problem)**
The app is heavily mouse-driven:
- Navigation is a horizontal top bar ([`Layout.tsx:153`](frontend/src/components/Layout.tsx:153)) that collapses to a hamburger grid on mobile ([`Layout.tsx:250`](frontend/src/components/Layout.tsx:250)); there is no keyboard access to it beyond tab order.
- List actions (edit/delete/view) are small 32px icon buttons ([`Assets.tsx:617`](frontend/src/pages/Assets.tsx:617)) with only `aria-label`, no keyboard-visible affordance and no shortcut.
- The skip link exists ([`Layout.tsx:137`](frontend/src/components/Layout.tsx:137)) but there is no way to jump between pages or trigger "New asset" without the mouse.
- [`plans/usability-improvement-recommendations.md`](plans/usability-improvement-recommendations.md:118) already flags "Keyboard shortcuts are not implemented. No bulk operations."

**Proposal**
1. Add a small set of global shortcuts: `g a` → Assets, `g r` → Risks, `g i` → Incidents, `g t` → Tickets, `n` (when on a list page) → create, `?` → show help overlay. Implement a single `useKeyboardShortcuts` hook to keep it DRY.
2. Make the icon action buttons focusable with visible focus rings (the `focus:ring` classes already exist on `actionButtonClassName` at [`Assets.tsx:59`](frontend/src/pages/Assets.tsx:59); ensure `tabIndex`/order is correct and add a "row actions" menu).
3. Add a lightweight command palette (e.g. `Ctrl/Cmd+K`) listing the top 15 actions and links, so power users and keyboard users reach any page without hunting through the nav bar.

**Impact / Effort**
- Impact: High for power users and accessibility; directly addresses the flagged gap.
- Effort: Medium — one hook + one palette component; guard all shortcuts so they only fire when not typing in a field.

---

### Proposal B2 — Persistent, resumable list state (filters, sorting, column order) via URL/`localStorage`

**Current state (problem)**
Every list view resets on navigation:
- The Assets page resets to page 1 whenever search/filter changes ([`Assets.tsx:285`](frontend/src/pages/Assets.tsx:285)) — correct for filter changes — but there is **no persistence** of the chosen filters, sort, or page after leaving the page or reloading. A user who filtered to `criticality=critical` and scrolled to page 3 loses everything on refresh.
- The Tickets page ([`Tickets.tsx:74`](frontend/src/pages/Tickets.tsx:74)) keeps filters only in component state; closing the tab discards them.
- Sorting is unavailable on both tables; the only way to reorder is server-side pagination with a fixed column order.

**Proposal**
1. Serialize the key filters (search, type, criticality, status, scope) and current page into the query string for the Assets and Tickets lists, so links are shareable and state survives reload/revisit. Reuse the existing debounce/pagination logic; only change where the state lives (source of truth = URL, not just `useState`).
2. Persist sort + column order per list in `localStorage` (a small `usePersistedView` hook keyed by route), so a user's preferred column order and sort direction are remembered.
3. Add a simple, client-side "clear view" control on top of the `ActiveFilters` chips ([`Assets.tsx:555`](frontend/src/pages/Assets.tsx:555)) to reset filters + sort in one click.

**Impact / Effort**
- Impact: High — shareable filtered URLs, no lost work on reload, real "operability" improvement for daily users.
- Effort: Medium — refactor state ownership to the URL; the server API already accepts `search`, `status`, `type`, `scope`, `page`, so no backend changes are needed.

---

## Prioritization Summary

| # | Dimension | Proposal | Effort | Impact | Suggested order |
|---|-----------|----------|--------|--------|-----------------|
| A1 | Optik | Design-token layer + semantic colors | Medium | High | 1 |
| A2 | Optik | Shared status/criticality badge system | Low–Medium | High | 2 |
| B1 | Bedienbarkeit | Global shortcuts + command palette | Medium | High | 3 |
| B2 | Bedienbarkeit | Persistent, shareable list state | Medium | High | 4 |

All four are frontend-only and can be validated with the existing Vitest + Playwright suite before touching the backend.
