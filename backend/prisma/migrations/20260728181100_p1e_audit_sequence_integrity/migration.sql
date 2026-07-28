CREATE SEQUENCE IF NOT EXISTS audit_log_sequence;

SELECT setval(
  'audit_log_sequence',
  GREATEST(COALESCE((SELECT MAX("sequence") FROM audit_logs), 0), 1),
  COALESCE((SELECT MAX("sequence") FROM audit_logs), 0) > 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_sequence_key" ON audit_logs("sequence");
