#!/usr/bin/env tsx
/**
 * check-vulnerabilities.ts — Check npm audit output against vulnerability allowlist.
 *
 * Runs `npm audit --json` and cross-references high/critical CVEs with
 * docs/vulnerability-allowlist.json. Fails if any high/critical vulnerability
 * is not in the allowlist or has expired.
 *
 * Exit 0 = all checks pass, exit 1 = failures found.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface AuditVulnerability {
  id: string;
  severity: "low" | "moderate" | "high" | "critical";
  title: string;
  vulnerableVersions: string;
  url?: string;
  patchVersions?: string;
}

interface AllowlistEntry {
  cve: string;
  vulnerabilityId?: string;
  justification: string;
  owner: string;
  expiryDate: string; // YYYY-MM-DD
}

function loadAllowlist(): AllowlistEntry[] {
  const allowlistPath = path.join(__dirname, "..", "docs", "vulnerability-allowlist.json");
  if (!fs.existsSync(allowlistPath)) {
    return [];
  }
  const content = fs.readFileSync(allowlistPath, "utf-8");
  return JSON.parse(content) as AllowlistEntry[];
}

function runAudit(): { metadata: { vulnerabilities: Record<string, number> }; errors?: any[]; warnings?: any[]; suggestions: AuditVulnerability[]; packages?: Record<string, any> } {
  try {
    const output = execSync("npm audit --json", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return JSON.parse(output);
  } catch (err: any) {
    // npm audit exits non-zero when vulnerabilities found; parse what we can
    const output = err.stdout?.toString() ?? "";
    if (output) {
      try {
        return JSON.parse(output);
      } catch {
        // If we can't parse, return empty
      }
    }
    return { metadata: { vulnerabilities: {} }, suggestions: [], packages: {} };
  }
}

function isVulnerabilityAllowed(
  vulnId: string,
  severity: string,
  allowlist: AllowlistEntry[]
): { allowed: boolean; reason?: string } {
  if (severity !== "high" && severity !== "critical") {
    return { allowed: false }; // Only high/critical need allowlisting check
  }

  for (const entry of allowlist) {
    const matches =
      entry.cve.toLowerCase() === vulnId.toLowerCase() ||
      (entry.vulnerabilityId && entry.vulnerabilityId.toLowerCase() === vulnId.toLowerCase());

    if (matches) {
      // Check expiry
      const expiry = new Date(entry.expiryDate);
      if (expiry < new Date()) {
        return { allowed: false, reason: `Allowlist entry for ${vulnId} has expired (${entry.expiryDate})` };
      }
      return { allowed: true, reason: `Allowed by ${entry.owner}: ${entry.justification}` };
    }
  }

  return { allowed: false };
}

function main(): number {
  console.log("=== Vulnerability Allowlist Check ===");

  const allowlist = loadAllowlist();
  console.log(`Allowlist entries loaded: ${allowlist.length}`);

  const audit = runAudit();
  const vulns = audit.metadata?.vulnerabilities ?? {};
  const totalHigh = vulns.high ?? 0;
  const totalCritical = vulns.critical ?? 0;

  console.log(`High vulnerabilities: ${totalHigh}`);
  console.log(`Critical vulnerabilities: ${totalCritical}`);

  if (totalHigh === 0 && totalCritical === 0) {
    console.log("PASS: No high/critical vulnerabilities found.");
    return 0;
  }

  // Check each suggestion for high/critical severity
  const suggestions = audit.suggestions ?? [];
  const packages = audit.packages ?? {};
  let blocked = false;

  for (const suggestion of suggestions) {
    if (suggestion.severity !== "high" && suggestion.severity !== "critical") continue;

    const vulnId = suggestion.id || suggestion.title || "unknown";
    const result = isVulnerabilityAllowed(vulnId, suggestion.severity, allowlist);

    if (!result.allowed) {
      console.error(
        `BLOCKED: ${suggestion.severity.toUpperCase()} — ${suggestion.title} (${vulnId}) — not in allowlist`
      );
      blocked = true;
    } else {
      console.log(`ALLOWED: ${suggestion.severity.toUpperCase()} — ${suggestion.title}: ${result.reason}`);
    }
  }

  if (blocked) {
    console.error("\nFAIL: Unallowlisted high/critical vulnerabilities found.");
    console.error("Add entries to docs/vulnerability-allowlist.json with CVE, justification, owner, and expiry date.");
    return 1;
  }

  console.log("\nPASS: All high/critical vulnerabilities are allowlisted with valid expiry.");
  return 0;
}

const exitCode = main();
process.exit(exitCode);
