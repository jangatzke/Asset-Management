/**
 * ci-config.test.ts — Validate .github/workflows/ci.yml structure and security gates.
 *
 * Tests:
 *   - All mandatory jobs exist in the workflow
 *   - No `|| true` neutralization in gate-critical steps
 *   - Semgrep outputs SARIF format (not JSON)
 *   - Release gates depend on all required jobs
 *   - Migration-test job exists
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "@jest/globals";

const CI_YML_PATH = path.join(__dirname, "..", "..", "..", ".github", "workflows", "ci.yml");

function readCiYml(): string {
  return fs.readFileSync(CI_YML_PATH, "utf-8");
}

describe("CI Configuration Validation (Phase 12)", () => {
  let content: string;

  beforeAll(() => {
    content = readCiYml();
  });

  /**
   * Extract the YAML section for a job by name.
   *
   * Uses a single fixed regex (no dynamic `new RegExp` from a template
   * literal) and filters the captured name, which satisfies Semgrep's
   * detect-non-literal-regexp audit rule.
   */
  function extractJob(name: string): string | undefined {
    const sectionRe = /(?:^|\n) {2}([a-z_-]+):([\s\S]*?)(?=\n {2}[a-z_-]+:|$)/g;
    let match: RegExpExecArray | null;
    while ((match = sectionRe.exec(content)) !== null) {
      if (match[1] === name) {
        return `${match[1]}:${match[2]}`;
      }
    }
    return undefined;
  }

  describe("Mandatory jobs exist", () => {
    const mandatoryJobs = [
      "lint:",
      "build:",
      "prisma-validate:",
      "unit-tests:",
      "integration-tests:",
      "frontend-tests:",
      "sast:",
      "dependency-scan:",
      "secret-scan:",
      "sbom:",
      "container-scan:",
      "requirements-check:",
      "migration-test:",
    ];

    for (const job of mandatoryJobs) {
      it(`contains job: ${job.trim()}`, () => {
        expect(content).toContain(job);
      });
    }
  });

  describe("Lint job gates (backend + frontend max-warnings 0)", () => {
    // extractJob is hoisted to the describe scope above (single fixed-regex implementation).

    it("lint job must run backend lint explicitly as a separate step", () => {
      const section = extractJob("lint");
      expect(section).toBeTruthy();
      expect(section).toContain("Run backend lint");
      expect(section).toContain("npm run lint --workspace backend");
    });

    it("lint job must enforce a frontend lint gate via npm run lint:ci --workspace frontend", () => {
      const section = extractJob("lint");
      expect(section).toBeTruthy();
      expect(section).toContain("Run frontend lint");
      expect(section).toContain("npm run lint:ci --workspace frontend");
    });

    it("frontend lint:ci script must chain ESLint --max-warnings 0 and the design-token guardrail", () => {
      const pkgPath = path.join(__dirname, "..", "..", "..", "frontend", "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
        scripts: Record<string, string>;
      };
      // lint:ci delegates to the strict local chain...
      expect(pkg.scripts["lint:ci"]).toContain("npm run lint");
      // ...which must fail on any warning and run the token ratchet.
      expect(pkg.scripts.lint).toContain("--max-warnings 0");
      expect(pkg.scripts.lint).toContain("check-design-tokens");
    });

    it("lint job must not neutralize lint failures with '|| true'", () => {
      const section = extractJob("lint");
      expect(section).toBeTruthy();
      const runLines = (section ?? "").split("\n").filter((l) => l.includes("run:"));
      for (const line of runLines) {
        expect(line).not.toContain("|| true");
      }
    });
  });

  describe("No security neutralization", () => {
    // extractJob is hoisted to the describe scope above (single fixed-regex implementation).

    it("must not contain '|| true' as shell neutralization in dependency-scan job run steps", () => {
      const section = extractJob("dependency-scan");
      expect(section).toBeTruthy();
      // Only check `run:` lines — the `if:` condition uses GitHub Actions expressions (||) which is fine
      const runLines = (section ?? "").split("\n").filter((l) => l.includes("run:"));
      for (const line of runLines) {
        expect(line).not.toContain("|| true");
      }
    });

    it("must not contain '|| true' in container-scan job", () => {
      const section = extractJob("container-scan");
      expect(section).toBeTruthy();
      expect(section).not.toContain("|| true");
    });

    it("must not contain '|| true' in sast job", () => {
      const section = extractJob("sast");
      expect(section).toBeTruthy();
      expect(section).not.toContain("|| true");
    });

    it("must not contain '|| true' in migration-test job", () => {
      const section = extractJob("migration-test");
      expect(section).toBeTruthy();
      expect(section).not.toContain("|| true");
    });

    it("must not contain '|| true' in requirements-check job", () => {
      const section = extractJob("requirements-check");
      expect(section).toBeTruthy();
      expect(section).not.toContain("|| true");
    });
  });

  describe("Semgrep SARIF output", () => {
    // extractJob is hoisted to the describe scope above (single fixed-regex implementation).

    it("sast job must use sarif output format, not json", () => {
      const section = extractJob("sast");
      expect(section).toBeTruthy();
      // Must use --output-format=sarif or .sarif extension
      expect(section).toMatch(/sarif/i);
      // Should NOT output JSON for SARIF upload
      expect(section).not.toMatch(/--json\s*--output=[^s]/i);
    });

    it("sast job must upload .sarif file to GitHub Security tab", () => {
      const section = extractJob("sast");
      expect(section).toBeTruthy();
      expect(section).toContain("upload-sarif");
      // sarif_file should not point to a json file
      const sarifFileMatch = section?.match(/sarif_file:\s*(\S+)/);
      if (sarifFileMatch) {
        // Verify the SARIF file does not have .json extension
        expect(sarifFileMatch[1].endsWith(".json")).toBe(false);
      }
    });
  });

  describe("Release gates dependencies", () => {
    it("release-gates job must depend on all mandatory jobs", () => {
      const regex = /release-gates:([\s\S]*?)(?=\n[ ]{2}[a-z_-]+:|$)/;
      const match = content.match(regex);
      expect(match).toBeTruthy();
      const releaseSection = match?.[0] ?? "";

      const requiredDeps = [
        "lint",
        "build",
        "prisma-validate",
        "unit-tests",
        "integration-tests",
        "frontend-tests",
        "sast",
        "dependency-scan",
        "secret-scan",
        "sbom",
        "container-scan",
        "requirements-check",
        "migration-test",
      ];

      for (const dep of requiredDeps) {
        expect(releaseSection).toContain(dep);
      }
    });
  });

  describe("Migration test job", () => {
    // extractJob is hoisted to the describe scope above (single fixed-regex implementation).

    it("migration-test job must exist and use PostgreSQL service", () => {
      const section = extractJob("migration-test");
      expect(section).toBeTruthy();
      expect(section).toContain("postgres");
      expect(section).toContain("prisma migrate deploy");
    });

    it("migration-test job must run seed after migration", () => {
      const section = extractJob("migration-test");
      expect(section).toBeTruthy();
      expect(section).toMatch(/seed/i);
    });
  });

  describe("Requirements-check job", () => {
    // extractJob is hoisted to the describe scope above (single fixed-regex implementation).

    it("requirements-check job must exist and run the requirements-check npm script", () => {
      const section = extractJob("requirements-check");
      expect(section).toBeTruthy();
      expect(section).toContain("npm run requirements-check");
    });

    it("requirements-check job must fail the pipeline on requirement violations", () => {
      const section = extractJob("requirements-check");
      expect(section).toBeTruthy();
      // Must NOT have || true to neutralize failures
      expect(section).not.toContain("|| true");
    });
  });

  describe("Dependency scan blocks on vulnerabilities", () => {
    // extractJob is hoisted to the describe scope above (single fixed-regex implementation).

    it("dependency-scan must not use '|| true' as shell neutralization to bypass audit failures", () => {
      const section = extractJob("dependency-scan");
      expect(section).toBeTruthy();
      // Only check `run:` lines — the `if:` condition uses GitHub Actions expressions (||) which is fine
      const runLines = (section ?? "").split("\n").filter((l) => l.includes("run:"));
      for (const line of runLines) {
        expect(line).not.toContain("|| true");
      }
    });

    it("dependency-scan must include vulnerability-allowlist check", () => {
      const section = extractJob("dependency-scan");
      expect(section).toBeTruthy();
      expect(section).toContain("check-vulnerabilities");
    });
  });

  describe("Secret scan job", () => {
    // extractJob is hoisted to the describe scope above (single fixed-regex implementation).

    it("secret-scan must use gitleaks or equivalent", () => {
      const section = extractJob("secret-scan");
      expect(section).toBeTruthy();
      expect(section).toMatch(/gitleaks/i);
    });
  });

  describe("SBOM generation", () => {
    // extractJob is hoisted to the describe scope above (single fixed-regex implementation).

    it("sbom job must generate CycloneDX or SPDX SBOM", () => {
      const section = extractJob("sbom");
      expect(section).toBeTruthy();
      expect(section).toMatch(/cyclonedx|spdx|syft/i);
    });
  });
});
