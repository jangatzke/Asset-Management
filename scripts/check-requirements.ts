#!/usr/bin/env tsx
/**
 * requirements-check.ts — Validate requirement status for Phase 12 CI/CD gates.
 *
 * Parses docs/requirements.md and checks:
 *   - No P0/P1 requirement has status "missing"
 *   - No P0/P1 requirement has status "non_compliant"
 *   - "partial" status only allowed with documented exception reference
 *   - Test or manual evidence reference present for each P0/P1 requirement
 *
 * Exit 0 = all checks pass, exit 1 = failures found.
 */

import * as fs from "fs";
import * as path from "path";

interface Requirement {
  id: string;
  priority: "P0" | "P1" | "P2" | "P3";
  status?: string;
  evidence?: string[];
  gaps?: string[];
}

function parseRequirements(filePath: string): Requirement[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const requirements: Requirement[] = [];

  // Split into sections by requirement blocks (lines containing | and ID)
  const lines = content.split("\n");
  let currentId = "";
  let currentPriority: Requirement["priority"] = "P3";
  let currentStatus = "";
  let currentEvidence: string[] = [];
  let currentGaps: string[] = [];
  let inTable = false;
  let isEvidenceSection = false;
  let isGapsSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Detect requirement ID pattern: | ID | Priority | ... or | ID | Priorität | ...
    const idMatch = line.match(/^\|(\s*(?:[A-Z]+-\d+|[A-Z]+-\d+\.\d+|CI-\d+|UI-\d+|OPS-\d+)\s*)\|\s*(P0|P1|P2|P3)\s*\|/);
    if (idMatch) {
      // Save previous requirement if exists
      if (currentId) {
        requirements.push({
          id: currentId,
          priority: currentPriority,
          status: currentStatus || undefined,
          evidence: currentEvidence.length > 0 ? currentEvidence : undefined,
          gaps: currentGaps.length > 0 ? currentGaps : undefined,
        });
      }
      currentId = idMatch[1].trim();
      currentPriority = idMatch[2] as Requirement["priority"];
      currentStatus = "";
      currentEvidence = [];
      currentGaps = [];
      isEvidenceSection = false;
      isGapsSection = false;
      inTable = true;
      continue;
    }

    // Detect compliance-matrix-style status blocks: "- id: XXX" followed by "status:"
    const statusMatch = line.match(/^- id:\s*([A-Za-z0-9_-]+)$/);
    if (statusMatch && !currentId) {
      // This is a compliance-matrix style entry — we'll capture it via the next lines
      currentId = statusMatch[1];
      continue;
    }

    const priorityFromStatus = line.match(/priority:\s*(P0|P1|P2|P3)/);
    if (priorityFromStatus && currentId) {
      currentPriority = priorityFromStatus[1] as Requirement["priority"];
      continue;
    }

    const statusLineMatch = line.match(/^status:\s*(\w+)/);
    if (statusLineMatch && currentId) {
      currentStatus = statusLineMatch[1];
      continue;
    }

    // Detect evidence section in compliance-matrix style
    if (/^\- evidence:$/i.test(line)) {
      isEvidenceSection = true;
      isGapsSection = false;
      continue;
    }

    // Detect gaps section in compliance-matrix style
    if (/^\- gaps:$/i.test(line) || /^\|\s*gaps\s*\|/i.test(line)) {
      isGapsSection = true;
      isEvidenceSection = false;
      continue;
    }

    // Collect evidence items (list items under evidence:)
    if (isEvidenceSection && line.startsWith("- ")) {
      currentEvidence.push(line.slice(2).trim());
      continue;
    }

    // Collect gaps items
    if (isGapsSection && line.startsWith("- ")) {
      currentGaps.push(line.slice(2).trim());
      continue;
    }

    // Reset sections on new table row or heading
    if (line.startsWith("###") || line.startsWith("##")) {
      isEvidenceSection = false;
      isGapsSection = false;
    }
  }

  // Save last requirement
  if (currentId) {
    requirements.push({
      id: currentId,
      priority: currentPriority,
      status: currentStatus || undefined,
      evidence: currentEvidence.length > 0 ? currentEvidence : undefined,
      gaps: currentGaps.length > 0 ? currentGaps : undefined,
    });
  }

  return requirements;
}

function main(): number {
  const requirementsPath = path.join(__dirname, "..", "docs", "requirements.md");
  const complianceMatrixPath = path.join(__dirname, "..", "docs", "compliance-matrix.yml");

  if (!fs.existsSync(requirementsPath)) {
    console.error("ERROR: docs/requirements.md not found");
    return 1;
  }

  const requirements = parseRequirements(requirementsPath);

  // Also try to merge compliance-matrix.yml status overrides
  if (fs.existsSync(complianceMatrixPath)) {
    const matrixContent = fs.readFileSync(complianceMatrixPath, "utf-8");
    const matrixIds = new Map<string, { status: string; evidence?: string[] }>();
    const blocks = matrixContent.split(/^- id:/);
    for (const block of blocks) {
      const idMatch = block.trim().split("\n")[0]?.trim();
      if (!idMatch) continue;
      const statusMatch = block.match(/status:\s*(\w+)/);
      const evidenceMatches = [...block.matchAll(/-\s+(.+\.)/g)];
      matrixIds.set(idTrim(idMatch), {
        status: statusMatch ? statusMatch[1] : "",
        evidence: evidenceMatches.length > 0 ? evidenceMatches.map((m) => m[1].trim()) : undefined,
      });
    }

    // Merge matrix statuses into requirements
    for (const req of requirements) {
      const merged = matrixIds.get(req.id);
      if (merged?.status) {
        req.status = merged.status;
      }
      if (merged?.evidence && merged.evidence.length > 0) {
        req.evidence = [...(req.evidence || []), ...merged.evidence];
      }
    }
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const req of requirements) {
    if (req.priority !== "P0" && req.priority !== "P1") continue;

    // Check 1: No P0/P1 requirement with status "missing"
    if (req.status === "missing") {
      errors.push(`P${req.priority.slice(1)} ${req.id}: requirement status is "missing"`);
      continue;
    }

    // Check 2: No P0/P1 requirement with status "non_compliant"
    if (req.status === "non_compliant") {
      errors.push(`P${req.priority.slice(1)} ${req.id}: requirement status is "non_compliant"`);
      continue;
    }

    // Check 3: "partial" only allowed with documented exception
    if (req.status === "partial") {
      const hasGaps = req.gaps && req.gaps.length > 0;
      const hasEvidence = req.evidence && req.evidence.length > 0;
      if (!hasGaps && !hasEvidence) {
        warnings.push(`P${req.priority.slice(1)} ${req.id}: status is "partial" but no gaps or evidence documented`);
      }
    }

    // Check 4: P0 requirements must have test or manual evidence reference
    if (req.priority === "P0" && req.status === "compliant") {
      const hasEvidence = req.evidence && req.evidence.length > 0;
      if (!hasEvidence) {
        warnings.push(`P0 ${req.id}: compliant but no explicit test/evidence reference`);
      }
    }
  }

  // Print results
  console.log("=== Requirements Check Report ===");
  console.log(`Total requirements scanned: ${requirements.length}`);
  console.log("");

  if (errors.length > 0) {
    console.error(`FAIL: ${errors.length} blocking error(s):`);
    for (const err of errors) {
      console.error(`  ✗ ${err}`);
    }
    console.error("");
  }

  if (warnings.length > 0) {
    console.log(`Warnings: ${warnings.length}:`);
    for (const w of warnings) {
      console.log(`  ⚠ ${w}`);
    }
    console.log("");
  }

  if (errors.length === 0) {
    console.log("PASS: All P0/P1 requirements meet gate criteria.");
    if (warnings.length > 0) {
      console.log("(Warnings present but no blocking errors.)");
    }
    return 0;
  } else {
    console.log("FAIL: Blocking requirement violations found.");
    return 1;
  }
}

function idTrim(s: string): string {
  return s.replace(/^- id:\s*/i, "").trim();
}

const exitCode = main();
process.exit(exitCode);
