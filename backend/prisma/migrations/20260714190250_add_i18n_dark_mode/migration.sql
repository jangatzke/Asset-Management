-- CreateTable
CREATE TABLE "_AssetRisks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_AssetControls" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_RiskControls" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_AssetRisks_AB_unique" ON "_AssetRisks"("A", "B");

-- CreateIndex
CREATE INDEX "_AssetRisks_B_index" ON "_AssetRisks"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_AssetControls_AB_unique" ON "_AssetControls"("A", "B");

-- CreateIndex
CREATE INDEX "_AssetControls_B_index" ON "_AssetControls"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_RiskControls_AB_unique" ON "_RiskControls"("A", "B");

-- CreateIndex
CREATE INDEX "_RiskControls_B_index" ON "_RiskControls"("B");

-- AddForeignKey
ALTER TABLE "_AssetRisks" ADD CONSTRAINT "_AssetRisks_A_fkey" FOREIGN KEY ("A") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssetRisks" ADD CONSTRAINT "_AssetRisks_B_fkey" FOREIGN KEY ("B") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssetControls" ADD CONSTRAINT "_AssetControls_A_fkey" FOREIGN KEY ("A") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssetControls" ADD CONSTRAINT "_AssetControls_B_fkey" FOREIGN KEY ("B") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RiskControls" ADD CONSTRAINT "_RiskControls_A_fkey" FOREIGN KEY ("A") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RiskControls" ADD CONSTRAINT "_RiskControls_B_fkey" FOREIGN KEY ("B") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
