/**
 * Stage 10c / LT-6 — Keyboard & focus guard (lightweight, no real E2E).
 *
 * Asserts that the central building blocks keep exposing a visible keyboard
 * focus indicator and are natively focusable:
 *  - PageHeader breadcrumbs (link/button per crumb)
 *  - DetailTabs (tab buttons + panels)
 *  - Drawer / Dialog (close button, panel)
 *  - Sidebar navigation entries
 *  - DataTableShell toolbar action buttons
 *
 * The guard works on the component sources (class-string checks). It is a
 * regression tripwire: removing the focus-ring tokens from one of these
 * building blocks fails CI until the change is deliberate and documented.
 * A manual keyboard test matrix lives in docs/phase15-design-system.md.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (relative: string): string =>
  readFileSync(resolve(__dirname, '..', relative), 'utf8');

/** Any accepted focus-indicator convention: outline-focus-ring or ring-focus-ring. */
const FOCUS_TOKEN_RE = /focus-visible:(?:outline|ring)(?:-\d+)?(?:-[^\s"']*)?focus-ring|focus-visible:[^\s"']*outline-focus-ring/;

function expectFocusTokens(file: string, source: string): void {
  expect(source, `${file} must reference a semantic focus-ring token`).toMatch(FOCUS_TOKEN_RE);
}

describe('keyboard focus guard (Stage 10c)', () => {
  it('PageHeader breadcrumbs render focusable links/buttons with a focus ring', () => {
    const source = src('components/PageHeader.tsx');
    // Breadcrumb entries are rendered as <Link> or <button> — natively focusable.
    expect(source).toMatch(/<(Link|button)\b/);
    expectFocusTokens('PageHeader.tsx', source);
  });

  it('DetailTabs tab buttons and panels carry focus-visible ring tokens', () => {
    const source = src('components/DetailTabs.tsx');
    expect(source).toMatch(/role="tab"/);
    expect(source).toMatch(/tabIndex=\{selected \? 0 : -1\}/); // roving tabindex
    expect(source).toMatch(/role="tabpanel"[\s\S]*?tabIndex=\{0\}/);
    expectFocusTokens('DetailTabs.tsx', source);
  });

  it('Drawer close control is a focusable button with a visible focus style', () => {
    const source = src('components/Drawer.tsx');
    expect(source).toMatch(/<button[\s\S]*?aria-label=\{t\('common\.close'\)\}/);
    // Inherits the shared overlay behavior (focus trap + restore) from the hook.
    expect(source).toContain('useOverlayBehavior');
    expectFocusTokens('Drawer.tsx', source);
  });

  it('Dialog close control is a focusable button with a visible focus style', () => {
    const source = src('components/Dialog.tsx');
    expect(source).toMatch(/<button[\s\S]*?aria-label=\{t\('common\.close'\)\}/);
    expect(source).toContain('useOverlayBehavior');
    expectFocusTokens('Dialog.tsx', source);
  });

  it('Sidebar entries are Link/button elements with a focus ring constant', () => {
    const source = src('components/Sidebar.tsx');
    expect(source).toMatch(/<Link\b/);
    // Central FOCUS_RING constant keeps the token usage auditable.
    expect(source).toMatch(/const FOCUS_RING =[\s\S]*?outline-focus-ring/);
  });

  it('DataTableShell toolbar action buttons use the semantic focus outline', () => {
    const source = src('components/DataTableShell.tsx');
    expect(source).toMatch(/<button type="button"/);
    expect(source).toContain('outline-focus-ring');
  });

  it('global :focus-visible fallback in index.css uses the semantic ring color', () => {
    const css = readFileSync(resolve(__dirname, '..', 'index.css'), 'utf8');
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--focus-ring-color\)/);
    // Stage 10c: high-contrast mode thickens the indicator via variables only.
    expect(css).toMatch(/\.contrast-high :focus-visible\s*\{[^}]*outline-width:\s*4px/);
  });
});
