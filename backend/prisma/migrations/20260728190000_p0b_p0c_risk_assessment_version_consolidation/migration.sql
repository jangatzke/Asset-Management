-- P0-B/P0-C: consolidate legacy risk_assessments into canonical risk_assessment_versions.
-- Preserve stable IDs where feasible: risk_assessment_versions.id is populated from legacy risk_assessments.id
-- when that ID does not already exist. Dependent acceptance/treatment IDs therefore remain stable.

BEGIN;

CREATE TABLE IF NOT EXISTS "risk_assessment_legacy_id_map" (
  "legacyAssessmentId" TEXT NOT NULL PRIMARY KEY,
  "riskAssessmentVersionId" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed explicit legacy -> canonical ID mapping. Prefer stable IDs.
INSERT INTO "risk_assessment_legacy_id_map" ("legacyAssessmentId", "riskAssessmentVersionId")
SELECT ra."id", COALESCE(existing."id", ra."id")
FROM "risk_assessments" ra
LEFT JOIN "risk_assessment_versions" existing ON existing."id" = ra."id"
ON CONFLICT ("legacyAssessmentId") DO NOTHING;

-- Migrate legacy assessments not already present as canonical versions.
INSERT INTO "risk_assessment_versions" (
  "id",
  "riskId",
  "riskMethodVersionId",
  "versionNumber",
  "assessmentType",
  "likelihood",
  "impact",
  "inherentRisk",
  "residualRisk",
  "targetRisk",
  "score",
  "assessorId",
  "assessedAt",
  "nextReviewDate",
  "justification",
  "status",
  "isCurrent",
  "isClosed",
  "closedAt",
  "createdAt"
)
SELECT
  m."riskAssessmentVersionId",
  ra."riskId",
  ra."riskMethodVersionId",
  ra."assessmentNumber",
  ra."assessmentType",
  ra."likelihood",
  ra."impact",
  ra."inherentRisk",
  ra."residualRisk",
  ra."targetRisk",
  ra."score",
  ra."assessorId",
  ra."assessedAt",
  ra."nextReviewDate",
  ra."justification",
  CASE WHEN ra."isCurrent" THEN 'draft' ELSE 'historical' END,
  ra."isCurrent",
  NOT ra."isCurrent",
  CASE WHEN ra."isCurrent" THEN NULL ELSE ra."assessedAt" END,
  ra."createdAt"
FROM "risk_assessments" ra
JOIN "risk_assessment_legacy_id_map" m ON m."legacyAssessmentId" = ra."id"
LEFT JOIN "risk_assessment_versions" rav ON rav."id" = m."riskAssessmentVersionId"
WHERE rav."id" IS NULL;

-- Ensure mapping covers all canonical copies where an equal stable ID already existed.
UPDATE "risk_assessment_legacy_id_map" m
SET "riskAssessmentVersionId" = ra."id"
FROM "risk_assessments" ra
WHERE m."legacyAssessmentId" = ra."id"
  AND EXISTS (SELECT 1 FROM "risk_assessment_versions" rav WHERE rav."id" = ra."id");

-- Move acceptance FK to canonical versions, preserving treatment and acceptance IDs.
ALTER TABLE "risk_acceptances" DROP CONSTRAINT IF EXISTS "risk_acceptances_assessmentId_fkey";

UPDATE "risk_acceptances" acc
SET "assessmentId" = m."riskAssessmentVersionId"
FROM "risk_assessment_legacy_id_map" m
WHERE acc."assessmentId" = m."legacyAssessmentId";

ALTER TABLE "risk_acceptances"
  ADD CONSTRAINT "risk_acceptances_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "risk_assessment_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Move treatment references to canonical versions.
UPDATE "risk_treatments" rt
SET "assessmentId" = m."riskAssessmentVersionId"
FROM "risk_assessment_legacy_id_map" m
WHERE rt."assessmentId" = m."legacyAssessmentId";

UPDATE "risk_treatments" rt
SET "residualAssessmentId" = m."riskAssessmentVersionId"
FROM "risk_assessment_legacy_id_map" m
WHERE rt."residualAssessmentId" = m."legacyAssessmentId";

-- Current-version invariant: only one current version per risk + assessment type.
WITH ranked_current AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "riskId", "assessmentType" ORDER BY "versionNumber" DESC, "createdAt" DESC, "id" DESC) AS rn
  FROM "risk_assessment_versions"
  WHERE "isCurrent" = true
)
UPDATE "risk_assessment_versions" rav
SET "isCurrent" = false,
    "isClosed" = true,
    "closedAt" = COALESCE(rav."closedAt", CURRENT_TIMESTAMP),
    "status" = CASE WHEN rav."status" = 'draft' THEN 'historical' ELSE rav."status" END
FROM ranked_current rc
WHERE rav."id" = rc."id" AND rc.rn > 1;

DROP INDEX IF EXISTS "risk_assessment_versions_one_current_per_kind";
CREATE UNIQUE INDEX "risk_assessment_versions_one_current_per_kind"
  ON "risk_assessment_versions"("riskId", "assessmentType")
  WHERE "isCurrent" = true;

CREATE INDEX IF NOT EXISTS "risk_assessment_versions_riskId_assessmentType_isCurrent_idx"
  ON "risk_assessment_versions"("riskId", "assessmentType", "isCurrent");

-- Legacy table is no longer productive after data and FK migration.
DROP TABLE IF EXISTS "risk_assessments";

COMMIT;
