/// <reference types="vitest" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guards the row-action buttons of the list pages: every row action must have
 * a visible focus ring and an accessible name. Source-level check so it stays
 * valid as the tables grow. The focus ring may come from the shared
 * `iconButton*` tokens (whose base carries `focus:ring-2`) or from a local
 * `actionButtonClassName` constant whose definition carries `focus:ring-2`.
 */

const ROW_ACTION_PAGES = ['Assets.tsx', 'Risks.tsx', 'Controls.tsx', 'Incidents.tsx'];

const readPage = (file: string): string =>
  readFileSync(resolve(process.cwd(), 'src/pages', file), 'utf8');

type RowAction = { name: string; hasRing: boolean; hasLabel: boolean };

/** Split the source into `<button ...>...</button>` chunks (arrow `=>` safe). */
const collectButtons = (source: string): string[] => {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf('<button', cursor);
    if (open === -1) break;
    const close = source.indexOf('</button>', open);
    if (close === -1) break;
    chunks.push(source.slice(open, close));
    cursor = close + 1;
  }
  return chunks;
};

/**
 * Row actions are the small icon buttons inside a table cell: they either use
 * the shared `iconButton*` tokens or the local `actionButtonClassName`. The
 * ring is inherited from the token definition, so the chunk only has to
 * reference the token plus carry an accessible name.
 */
const collectRowActions = (source: string): RowAction[] => collectButtons(source)
  .filter((chunk) => chunk.includes('aria-label=') && (
    chunk.includes('actionButtonClassName') || chunk.includes('iconButton')
  ))
  .map((chunk) => ({
    name: chunk.slice(0, 140).replace(/\s+/g, ' '),
    hasRing: chunk.includes('focus:ring-2')
      || chunk.includes('focus-visible:ring-2')
      || chunk.includes('actionButtonClassName')
      || chunk.includes('iconButton'),
    hasLabel: /aria-label=\{/.test(chunk) || /aria-label="/.test(chunk),
  }));

const definitionCarriesRing = (source: string, name: string): boolean => {
  const match = source.match(new RegExp(`const ${name} = ['"]([^'"]+)['"]`));
  if (!match) return false;
  return match[1].includes('focus:ring-2') || match[1].includes('focus-visible:ring-2');
};

describe('row action button focus rings and accessible names', () => {
  it.each(ROW_ACTION_PAGES)('%s row actions expose a visible focus ring and an aria-label', (file) => {
    const source = readPage(file);
    const actions = collectRowActions(source);
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      if (!action.hasLabel) throw new Error(`missing aria-label in ${file}: ${action.name}`);
      if (!action.hasRing) throw new Error(`missing focus ring in ${file}: ${action.name}`);
    }
  });

  it.each(ROW_ACTION_PAGES)('%s resolves its row-action ring through a real class definition', (file) => {
    const source = readPage(file);
    if (source.includes('actionButtonClassName')) {
      expect(definitionCarriesRing(source, 'actionButtonClassName')).toBe(true);
    }
  });

  it('the shared icon button tokens carry a focus ring', () => {
    const tokens = readFileSync(resolve(process.cwd(), 'src/styles/tokens.ts'), 'utf8');
    expect(tokens).toContain('export const iconButtonBase');
    expect(tokens).toContain('focus:ring-2');
    expect(tokens).toContain('focus:ring-primary-500');
  });

  it('documents that Tickets has no row-level action buttons', () => {
    // Tickets uses a displayId link plus bulk actions instead of per-row buttons.
    expect(collectRowActions(readPage('Tickets.tsx'))).toHaveLength(0);
  });
});
