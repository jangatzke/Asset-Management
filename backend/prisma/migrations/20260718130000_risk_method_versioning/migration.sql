-- ==========================================
-- Paket 3.1: Versionierte Risikomethoden
-- ==========================================

-- 1. RiskMethod: calculationType und formulaExpression einführen, alte Spalte migrieren
ALTER TABLE "risk_methods" ADD COLUMN "calculationType" VARCHAR NOT NULL DEFAULT 'product';
ALTER TABLE "risk_methods" ADD COLUMN "formulaExpression" TEXT;

-- Bestehende "formula" Werte nach formulaExpression migrieren (falls vorhanden)
-- Die Spalte "formula" bleibt vorerst erhalten und wird in der Anwendung deprecated behandelt.

-- 2. Neue Tabelle: RiskMethodVersion (immutable Snapshots)
CREATE TABLE "risk_method_versions" (
    "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "riskMethodId"      UUID NOT NULL,
    "versionTag"        VARCHAR NOT NULL,
    "likelihoodScale"   JSONB NOT NULL,
    "impactScale"       JSONB NOT NULL,
    "ratingDimensions"  JSONB NOT NULL,
    "calculationType"   VARCHAR NOT NULL DEFAULT 'product',
    "formulaExpression" TEXT,
    "riskClasses"       JSONB NOT NULL,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "isImmutable"       BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "risk_method_versions_riskMethodId_fkey"
        FOREIGN KEY ("riskMethodId") REFERENCES "risk_methods"("id") ON DELETE CASCADE
);

CREATE INDEX "risk_method_versions_riskMethodId_idx" ON "risk_method_versions"("riskMethodId");

-- 3. Risk: riskMethodVersionId hinzufügen
ALTER TABLE "risks" ADD COLUMN "riskMethodVersionId" UUID;
ALTER TABLE "risks" ADD CONSTRAINT "risks_riskMethodVersionId_fkey"
    FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE SET NULL;
CREATE INDEX "risks_riskMethodVersionId_idx" ON "risks"("riskMethodVersionId");

-- 4. Neue Tabelle: RiskAssessment (versionierte Bewertungen)
CREATE TABLE "risk_assessments" (
    "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "riskId"              UUID NOT NULL,
    "riskMethodVersionId" UUID NOT NULL,
    "assessmentNumber"    INT NOT NULL DEFAULT 1,
    "likelihood"          INT NOT NULL,
    "impact"              INT NOT NULL,
    "inherentRisk"        VARCHAR NOT NULL,
    "residualRisk"        VARCHAR NOT NULL,
    "targetRisk"          VARCHAR NOT NULL,
    "score"               INT,
    "assessorId"          VARCHAR NOT NULL,
    "assessedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "nextReviewDate"      TIMESTAMPTZ NOT NULL,
    "justification"       TEXT,
    "isCurrent"           BOOLEAN NOT NULL DEFAULT true,
    "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "risk_assessments_riskId_fkey"
        FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE,
    CONSTRAINT "risk_assessments_riskMethodVersionId_fkey"
        FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE RESTRICT,
    CONSTRAINT "risk_assessments_riskNumber_unique" UNIQUE ("riskId", "assessmentNumber"),
    CONSTRAINT "risk_assessments_riskCurrent_unique" UNIQUE ("riskId", "isCurrent")
);

CREATE INDEX "risk_assessments_riskId_isCurrent_idx" ON "risk_assessments"("riskId", "isCurrent");
CREATE INDEX "risk_assessments_riskMethodVersionId_idx" ON "risk_assessments"("riskMethodVersionId");

-- 5. Initial-Snapshots f&uuml;r bestehende RiskMethods erzeugen
INSERT INTO "risk_method_versions" (
    "riskMethodId",
    "versionTag",
    "likelihoodScale",
    "impactScale",
    "ratingDimensions",
    "calculationType",
    "formulaExpression",
    "riskClasses",
    "isImmutable"
)
SELECT
    "id",
    "version" || '-snapshot-1',
    "likelihoodScale",
    "impactScale",
    "ratingDimensions",
    COALESCE("calculationType", 'product'),
    "formula",
    "riskClasses",
    false
FROM "risk_methods"
WHERE NOT "isArchived";
