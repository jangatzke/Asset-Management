-- CreateTable: ISO 27001 A.8.32 change-to-risk linkage
CREATE TABLE "change_risk_links" (
    "id" TEXT NOT NULL,
    "changeId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_risk_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "change_risk_links_changeId_riskId_key" ON "change_risk_links"("changeId", "riskId");

-- CreateIndex
CREATE INDEX "change_risk_links_riskId_idx" ON "change_risk_links"("riskId");

-- AddForeignKey
ALTER TABLE "change_risk_links" ADD CONSTRAINT "change_risk_links_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_risk_links" ADD CONSTRAINT "change_risk_links_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
