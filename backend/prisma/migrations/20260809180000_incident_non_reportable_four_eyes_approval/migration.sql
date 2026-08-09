-- A nullable assignment preserves existing incident assessments while separating
-- the selected approver from the immutable, actual approval attribution fields.
ALTER TABLE "incident_assessments"
  ADD COLUMN "decisionApprovalAssigneeId" TEXT;

CREATE INDEX "incident_assessments_decisionApprovalAssigneeId_status_idx"
  ON "incident_assessments"("decisionApprovalAssigneeId", "status");
