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

type AuditSeverity = "info" | "low" | "moderate" | "high" | "critical";

interface AuditViaAdvisory {
  url?: string;
  severity?: AuditSeverity;
}

interface AuditPackageVulnerability {
  name: string;
  severity: AuditSeverity;
  via: Array<string | AuditViaAdvisory>;
}

interface AuditReport {
  auditReportVersion: 2;
  metadata: { vulnerabilities: Record<string, number> };
  vulnerabilities: Record<string, AuditPackageVulnerability>;
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

function runAudit(): AuditReport {
  try {
    const output = execSync("npm audit --json", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    const report = JSON.parse(output) as Partial<AuditReport>;
    if (report.auditReportVersion !== 2 || !report.metadata?.vulnerabilities || !report.vulnerabilities) {
      throw new Error("npm audit did not return a valid audit report");
    }
    return report as AuditReport;
  } catch (err: any) {
    // npm audit exits non-zero when vulnerabilities found; parse what we can
    const output = err.stdout?.toString() ?? "";
    if (output) {
      try {
        const report = JSON.parse(output) as Partial<AuditReport>;
        if (report.auditReportVersion === 2 && report.metadata?.vulnerabilities && report.vulnerabilities) {
          return report as AuditReport;
        }
      } catch {
        // The error below fails closed if audit output cannot be parsed.
      }
    }
    throw new Error(`Unable to obtain a valid npm audit report: ${err.message}`);
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

  let audit: AuditReport;
  try {
    audit = runAudit();
  } catch (error) {
    console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const vulns = audit.metadata?.vulnerabilities ?? {};
  const totalHigh = vulns.high ?? 0;
  const totalCritical = vulns.critical ?? 0;

  console.log(`High vulnerabilities: ${totalHigh}`);
  console.log(`Critical vulnerabilities: ${totalCritical}`);

  if (totalHigh === 0 && totalCritical === 0) {
    console.log("PASS: No high/critical vulnerabilities found.");
    return 0;
  }

  // npm audit v2 reports advisories in `vulnerabilities`; the legacy
  // `suggestions` field is absent. Derive the stable GHSA/CVE identifier from
  // every direct advisory URL so an empty placeholder allowlist cannot turn a
  // failing security gate into a false pass.
  //
  // Transitive dependents (e.g. micromatch pulled in via the braces advisory)
  // only carry string `via` references and no direct advisory URL. Resolve each
  // package's dependency chain to the underlying GHSA/CVE identifiers: an
  // allowlisted root advisory then also covers its dependents, while any
  // unallowlisted advisory anywhere in the chain still fails the gate closed.
  const byName = audit.vulnerabilities ?? {};

  function collectAdvisoryIds(
    name: string,
    seen: Set<string> = new Set()
  ): Array<{ id: string; severity: AuditSeverity }> {
    const found: Array<{ id: string; severity: AuditSeverity }> = [];
    if (seen.has(name)) return found;
    seen.add(name);
    const entry = byName[name];
    if (!entry) return found;
    for (const via of entry.via) {
      if (typeof via === "string") {
        found.push(...collectAdvisoryIds(via, seen));
        continue;
      }
      if (via.severity !== "high" && via.severity !== "critical") continue;
      const id = via.url?.match(/(GHSA-[a-z0-9-]+|CVE-\d{4}-\d+)/i)?.[1] ?? name;
      found.push({ id, severity: via.severity });
    }
    return found;
  }

  let blocked = false;

  for (const vulnerability of Object.values(byName)) {
    if (vulnerability.severity !== "high" && vulnerability.severity !== "critical") continue;

    const advisories = collectAdvisoryIds(vulnerability.name);
    if (advisories.length === 0) {
      console.error(`BLOCKED: ${vulnerability.severity.toUpperCase()} — ${vulnerability.name} has no direct advisory identifier`);
      blocked = true;
      continue;
    }

    const uniqueAdvisories = new Map<string, AuditSeverity>();
    for (const advisory of advisories) {
      if (!uniqueAdvisories.has(advisory.id)) uniqueAdvisories.set(advisory.id, advisory.severity);
    }

    let packageBlocked = false;
    for (const [vulnId, severity] of uniqueAdvisories) {
      const result = isVulnerabilityAllowed(vulnId, severity, allowlist);
      if (!result.allowed) {
        console.error(`BLOCKED: ${severity.toUpperCase()} — ${vulnerability.name} (${vulnId}) — not in allowlist`);
        packageBlocked = true;
      } else {
        console.log(`ALLOWED: ${severity.toUpperCase()} — ${vulnerability.name} (${vulnId}): ${result.reason}`);
      }
    }
    if (packageBlocked) blocked = true;
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
