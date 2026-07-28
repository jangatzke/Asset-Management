#!/usr/bin/env tsx
/**
 * Fail-closed P0/P1 requirements gate.
 *
 * A P0/P1 requirement passes only when the compliance matrix records concrete
 * implementation, regression test, and evidence references with no open gaps.
 * Temporary acceptance is allowed only with reason, owner, and non-expired
 * expiry date.
 */

import * as fs from 'fs';
import * as path from 'path';

type Priority = 'P0' | 'P1' | 'P2' | 'P3';

interface TemporaryAcceptance {
  reason?: string;
  owner?: string;
  expiry?: string;
}

interface MatrixRequirement {
  id: string;
  priority?: Priority;
  status?: string;
  implementation: string[];
  tests: string[];
  evidence: string[];
  gaps: string[];
  temporaryAcceptance?: TemporaryAcceptance;
}

const BLOCKED_STATUSES = new Set(['missing', 'non_compliant', 'partial', 'planned', 'undefined']);
const PASSING_STATUSES = new Set(['implemented', 'tested', 'evidence-capable']);
const DOC_ONLY_IMPLEMENTATION = /^(?:docs\/|README\.md$)/i;

function parseList(lines: string[], startIndex: number): { values: string[]; nextIndex: number } {
  const values: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const match = lines[index].match(/^\s*-\s+(.+)\s*$/);
    if (!match) break;
    values.push(match[1].trim());
    index += 1;
  }

  return { values, nextIndex: index };
}

function parseTemporaryAcceptance(lines: string[], startIndex: number): { value: TemporaryAcceptance; nextIndex: number } {
  const value: TemporaryAcceptance = {};
  let index = startIndex;

  while (index < lines.length) {
    const match = lines[index].match(/^\s{4,}([A-Za-z_]+):\s*(.+)\s*$/);
    if (!match) break;

    const key = match[1].replace(/_([a-z])/g, (_all, letter: string) => letter.toUpperCase());
    if (key === 'reason' || key === 'owner' || key === 'expiry') {
      value[key] = match[2].trim();
    }
    index += 1;
  }

  return { value, nextIndex: index };
}

export function parseComplianceMatrix(content: string): MatrixRequirement[] {
  const blocks = content.split(/^\s*- id:\s*/m).slice(1);
  return blocks.map((block) => {
    const lines = block.split('\n');
    const id = lines[0].trim();
    const requirement: MatrixRequirement = {
      id,
      implementation: [],
      tests: [],
      evidence: [],
      gaps: [],
    };

    for (let index = 1; index < lines.length;) {
      const line = lines[index];
      const scalar = line.match(/^\s{2}([A-Za-z_]+):\s*(.*)\s*$/);

      if (!scalar) {
        index += 1;
        continue;
      }

      const key = scalar[1];
      const value = scalar[2].trim();

      if (key === 'priority' && /^(P0|P1|P2|P3)$/.test(value)) {
        requirement.priority = value as Priority;
        index += 1;
        continue;
      }

      if (key === 'status') {
        requirement.status = value;
        index += 1;
        continue;
      }

      if (key === 'implementation' || key === 'tests' || key === 'evidence' || key === 'gaps') {
        if (value === '[]') {
          requirement[key] = [];
          index += 1;
          continue;
        }

        const parsed = parseList(lines, index + 1);
        requirement[key] = parsed.values;
        index = parsed.nextIndex;
        continue;
      }

      if (key === 'temporary_acceptance') {
        const parsed = parseTemporaryAcceptance(lines, index + 1);
        requirement.temporaryAcceptance = parsed.value;
        index = parsed.nextIndex;
        continue;
      }

      index += 1;
    }

    return requirement;
  });
}

function hasTemporaryAcceptance(req: MatrixRequirement, now: Date): boolean {
  const acceptance = req.temporaryAcceptance;
  if (!acceptance?.reason || !acceptance.owner || !acceptance.expiry) return false;

  const expiry = new Date(acceptance.expiry);
  if (Number.isNaN(expiry.getTime())) return false;

  return expiry.getTime() >= now.getTime();
}

export function validateRequirement(req: MatrixRequirement, now: Date): string[] {
  const errors: string[] = [];
  const temporaryAccepted = hasTemporaryAcceptance(req, now);

  if (!req.status) {
    errors.push(`${req.id}: missing status`);
  } else if (BLOCKED_STATUSES.has(req.status)) {
    errors.push(`${req.id}: blocked status "${req.status}"`);
  } else if (!PASSING_STATUSES.has(req.status) && !temporaryAccepted) {
    errors.push(`${req.id}: status "${req.status}" is not a passing application-coverage status`);
  }

  if (req.implementation.length === 0 && !temporaryAccepted) {
    errors.push(`${req.id}: missing implementation reference`);
  }

  if (req.implementation.length > 0 && req.implementation.every((item) => DOC_ONLY_IMPLEMENTATION.test(item))) {
    errors.push(`${req.id}: docs-only implementation reference is not sufficient`);
  }

  if (req.tests.length === 0 && !temporaryAccepted) {
    errors.push(`${req.id}: missing regression test reference`);
  }

  if (req.evidence.length === 0 && !temporaryAccepted) {
    errors.push(`${req.id}: missing evidence reference`);
  }

  if (req.gaps.length > 0 && !temporaryAccepted) {
    errors.push(`${req.id}: open gaps require explicit temporary_acceptance with reason, owner, and non-expired expiry`);
  }

  if (req.temporaryAcceptance && !temporaryAccepted) {
    errors.push(`${req.id}: temporary_acceptance is incomplete, invalid, or expired`);
  }

  return errors;
}

export function runRequirementsCheck(rootDir: string, now = new Date()): { errors: string[]; scanned: number } {
  const matrixPath = path.join(rootDir, 'docs', 'compliance-matrix.yml');

  if (!fs.existsSync(matrixPath)) {
    return { errors: ['docs/compliance-matrix.yml not found'], scanned: 0 };
  }

  const requirements = parseComplianceMatrix(fs.readFileSync(matrixPath, 'utf-8'));
  const gatedRequirements = requirements.filter((req) => req.priority === 'P0' || req.priority === 'P1');
  const errors = gatedRequirements.flatMap((req) => validateRequirement(req, now));

  return { errors, scanned: gatedRequirements.length };
}

function main(): number {
  const result = runRequirementsCheck(path.join(__dirname, '..'));

  console.log('=== Requirements Check Report ===');
  console.log(`P0/P1 requirements scanned: ${result.scanned}`);

  if (result.errors.length === 0) {
    console.log('PASS: All P0/P1 requirements meet fail-closed gate criteria.');
    return 0;
  }

  console.error(`FAIL: ${result.errors.length} blocking requirement gate violation(s):`);
  for (const error of result.errors) {
    console.error(`  ✗ ${error}`);
  }
  return 1;
}

if (require.main === module) {
  process.exit(main());
}
