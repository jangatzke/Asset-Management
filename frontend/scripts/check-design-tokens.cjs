#!/usr/bin/env node
/**
 * Design-token guardrail (LT-2, Stage 10a) — no external dependencies.
 *
 * Scans `src/pages/**` and `src/components/**` for "DIY" styling regressions:
 *   - raw palette utility classes: (bg|text|border|divide|ring)-(gray|red|green|
 *     amber|blue|indigo|purple|orange|emerald|sky|slate)-<number> — this also
 *     catches `dark:bg-gray-…` style surface overrides;
 *   - MUI `sx=` props in pages/components (documented MUI modules excepted).
 *
 * RATCHET MECHANISM: existing debt is frozen in scripts/design-token-baseline.json
 * (per-file violation counts, generated with --update-baseline). The script fails
 * only when a file EXCEEDS its recorded count or a new offending file appears —
 * so the legacy inventory cannot grow and every cleaned-up file stays clean.
 *
 * Usage:
 *   node scripts/check-design-tokens.cjs               # gate (exit 1 on regression)
 *   node scripts/check-design-tokens.cjs --update-baseline   # re-record current state
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const BASELINE_FILE = path.join(__dirname, 'design-token-baseline.json');

// Raw palette utilities (Tailwind default colors) that must not appear in
// pages/components — semantic tokens / recipes only. Also matches dark: variants.
const RAW_PALETTE_RE = /(?:bg|text|border|divide|ring)-(?:gray|red|green|amber|blue|indigo|purple|orange|emerald|sky|slate)-\d+/g;
// MUI sx overrides (documented MUI modules are allowlisted below).
const SX_RE = /\bsx=\{/g;

// Documented exceptions: MUI-only admin modules and the shared MUI table
// component use Material UI props (`sx`) by design — see docs/phase15-design-system.md.
const SX_ALLOWLIST = new Set([
  'src/pages/AdminIntune.tsx',
  'src/pages/AdminProxmox.tsx',
  'src/pages/AdminVMware.tsx',
  'src/components/DiscardConfirmationDialog.tsx',
  'src/components/MuiSortableTh.tsx',
]);

const SCAN_DIRS = ['pages', 'components'];
const EXTENSIONS = ['.ts', '.tsx'];
// Tests inside pages/ may assert legacy class strings — they are not runtime code.
const isTestFile = (file) => /\.(test|page\.test)\.tsx?$/.test(file);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      yield full;
    }
  }
}

function scan() {
  /** @type {Record<string, number>} relPath -> violation count */
  const found = {};
  for (const sub of SCAN_DIRS) {
    const dir = path.join(SRC_DIR, sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const rel = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
      if (isTestFile(rel)) continue;
      const content = fs.readFileSync(file, 'utf8');
      let count = 0;
      for (const match of content.matchAll(RAW_PALETTE_RE)) {
        count++;
        void match;
      }
      if (!SX_ALLOWLIST.has(rel)) {
        count += [...content.matchAll(SX_RE)].length;
      }
      if (count > 0) found[rel] = count;
    }
  }
  return found;
}

function main() {
  const update = process.argv.includes('--update-baseline');
  const found = scan();

  if (update) {
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(found, null, 2) + '\n', 'utf8');
    const total = Object.values(found).reduce((a, b) => a + b, 0);
    console.log(`Baseline written: ${total} violations in ${Object.keys(found).length} files.`);
    return;
  }

  let baseline = {};
  if (fs.existsSync(BASELINE_FILE)) {
    baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  }

  const regressions = [];
  for (const [file, count] of Object.entries(found)) {
    const allowed = baseline[file] ?? 0;
    if (count > allowed) regressions.push({ file, count, allowed });
  }

  if (regressions.length === 0) {
    const total = Object.values(found).reduce((a, b) => a + b, 0);
    console.log(`design-token guardrail OK: ${total} grandfathered legacy violation(s), no regressions.`);
    return;
  }

  console.error('Design-token guardrail FAILED — raw palette / sx usage grew:');
  for (const r of regressions) {
    console.error(`  ${r.file}: ${r.count} occurrence(s), baseline allows ${r.allowed}`);
  }
  console.error('Use semantic tokens (styles/tokens.ts recipes or bg-surface-*/text-text-* utilities) instead.');
  process.exit(1);
}

main();
