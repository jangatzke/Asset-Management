ALTER TABLE "group_roles" ADD COLUMN "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "group_roles" ADD COLUMN "validUntil" TIMESTAMP(3);
CREATE INDEX "group_roles_validFrom_validUntil_idx" ON "group_roles"("validFrom", "validUntil");
