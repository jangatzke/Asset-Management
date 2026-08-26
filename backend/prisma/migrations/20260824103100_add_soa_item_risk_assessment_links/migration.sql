-- Add SoA item <-> risk assessment version linkage (SoA-Risk-Linkage, proposal #8)

CREATE TABLE IF NOT EXISTS "soa_item_risk_assessments" (
  "id" TEXT NOT NULL,
  "soaItemId" TEXT NOT NULL,
  "riskAssessmentVersionId" TEXT NOT NULL,
  CONSTRAINT "soa_item_risk_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "soa_item_risk_assessments_soaItemId_riskAssessmentVersionId_key" ON "soa_item_risk_assessments"("soaItemId", "riskAssessmentVersionId");
CREATE INDEX IF NOT EXISTS "soa_item_risk_assessments_riskAssessmentVersionId_idx" ON "soa_item_risk_assessments"("riskAssessmentVersionId");

ALTER TABLE "soa_item_risk_assessments" ADD CONSTRAINT "soa_item_risk_assessments_soaItemId_fkey" FOREIGN KEY ("soaItemId") REFERENCES "soa_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
