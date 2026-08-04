-- Audit sequences are allocated by AuditService under a transaction-scoped
-- chain lock. A default of zero lets direct Prisma creates violate the unique
-- index after the first row, so require every writer to provide a sequence.
ALTER TABLE audit_logs ALTER COLUMN "sequence" DROP DEFAULT;
