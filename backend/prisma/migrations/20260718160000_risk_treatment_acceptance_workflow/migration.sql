ALTER TABLE "risk_treatments" ADD COLUMN "assessmentId" TEXT;
ALTER TABLE "risk_treatments" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "risk_treatments" ADD COLUMN "completedBy" TEXT;
ALTER TABLE "risk_treatments" ADD COLUMN "residualAssessmentId" TEXT;

CREATE TABLE "risk_acceptances" (
    "id" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requiredLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "risk_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "risk_treatment_approvals" (
    "id" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approvalLevel" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "risk_treatment_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "risk_treatment_effectiveness_reviews" (
    "id" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "risk_treatment_effectiveness_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "risk_acceptances_treatmentId_key" ON "risk_acceptances"("treatmentId");
CREATE INDEX "risk_acceptances_riskId_idx" ON "risk_acceptances"("riskId");
CREATE INDEX "risk_acceptances_assessmentId_idx" ON "risk_acceptances"("assessmentId");
CREATE INDEX "risk_acceptances_status_idx" ON "risk_acceptances"("status");
CREATE INDEX "risk_treatment_approvals_treatmentId_idx" ON "risk_treatment_approvals"("treatmentId");
CREATE INDEX "risk_treatment_approvals_approverId_idx" ON "risk_treatment_approvals"("approverId");
CREATE INDEX "risk_treatment_effectiveness_reviews_treatmentId_idx" ON "risk_treatment_effectiveness_reviews"("treatmentId");
CREATE INDEX "risk_treatment_effectiveness_reviews_reviewerId_idx" ON "risk_treatment_effectiveness_reviews"("reviewerId");
CREATE INDEX "risk_treatments_riskId_idx" ON "risk_treatments"("riskId");
CREATE INDEX "risk_treatments_assessmentId_idx" ON "risk_treatments"("assessmentId");

ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "risk_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "risk_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "risk_treatment_approvals" ADD CONSTRAINT "risk_treatment_approvals_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "risk_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_treatment_effectiveness_reviews" ADD CONSTRAINT "risk_treatment_effectiveness_reviews_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "risk_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
