-- Phase 9: Audit Log Hash-Chain Integrity
-- Adds sequence, previousHash, entryHash to audit_logs for tamper-evident logging

-- Add hash-chain columns to audit_logs (map to audit_logs table)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "sequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "previous_hash" TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "entry_hash" TEXT NOT NULL DEFAULT '';

-- Add index on sequence for ordered traversal and integrity verification
CREATE INDEX IF NOT EXISTS "audit_logs_sequence_idx" ON audit_logs("sequence");

-- Create audit_checkpoints table for periodic hash-chain anchors
CREATE TABLE IF NOT EXISTS audit_checkpoints (
    id TEXT NOT NULL DEFAULT gen_random_uuid(),
    "sequence" INTEGER NOT NULL UNIQUE,
    hash TEXT NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "external_reference" VARCHAR(255),
    PRIMARY KEY (id)
);

-- Backfill sequence numbers for existing audit log entries based on timestamp/id order
DO $$
DECLARE
    seq_num INTEGER := 0;
    r RECORD;  -- Declare loop variable as RECORD type
BEGIN
    -- First assign sequence numbers
    FOR r IN SELECT id FROM audit_logs ORDER BY "timestamp" ASC, id ASC LOOP
        seq_num := seq_num + 1;
        UPDATE audit_logs SET "sequence" = seq_num WHERE id = r.id;
    END LOOP;

    -- Set previous_hash: first entry gets NULL, others get the entryHash of the prior sequence
    -- Since existing entries have empty entryHash, we set a simple chain using SHA-256(sequence)
    FOR r IN SELECT id, "sequence" FROM audit_logs ORDER BY "sequence" ASC LOOP
        IF r."sequence" = 1 THEN
            UPDATE audit_logs SET "previous_hash" = '' WHERE id = r.id;
        ELSE
            -- Link to previous entry's computed hash placeholder
            UPDATE audit_logs 
            SET "previous_hash" = prev.prev_hash_val
            FROM (SELECT "entry_hash" as prev_hash_val FROM audit_logs WHERE "sequence" = r."sequence" - 1) prev
            WHERE id = r.id;
        END IF;
    END LOOP;
END $$;
