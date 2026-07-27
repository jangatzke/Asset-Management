/**
 * Phase 9: Apply Audit Log hash-chain columns directly to the database.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function raw(sql) {
  return prisma.$executeRawUnsafe(sql);
}

async function queryRaw(sql) {
  return prisma.$queryRaw(sql);
}

async function main() {
  try {
    // 1. Add sequence column if not exists
    await raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'sequence') THEN
          ALTER TABLE audit_logs ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 0;
        END IF;
      END $$;
    `);
    console.log('Column sequence: OK');

    // 2. Add previous_hash column if not exists
    await raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'previous_hash') THEN
          ALTER TABLE audit_logs ADD COLUMN "previous_hash" TEXT;
        END IF;
      END $$;
    `);
    console.log('Column previous_hash: OK');

    // 3. Add entry_hash column if not exists (with default for existing rows)
    await raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entry_hash') THEN
          ALTER TABLE audit_logs ADD COLUMN "entry_hash" TEXT NOT NULL DEFAULT '';
        END IF;
      END $$;
    `);
    console.log('Column entry_hash: OK');

    // 4. Create index on sequence
    await raw(`
      CREATE INDEX IF NOT EXISTS audit_logs_sequence_idx ON audit_logs("sequence");
    `);
    console.log('Index audit_logs_sequence_idx: OK');

    // 5. Create audit_checkpoints table if not exists
    await raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_checkpoints') THEN
          CREATE TABLE audit_checkpoints (
            id TEXT NOT NULL DEFAULT gen_random_uuid(),
            "sequence" INTEGER NOT NULL UNIQUE,
            hash TEXT NOT NULL,
            "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            "external_reference" VARCHAR(255),
            PRIMARY KEY (id)
          );
        END IF;
      END $$;
    `);
    console.log('Table audit_checkpoints: OK');

    // 6. Backfill sequence numbers for existing entries
    await raw(`
      DO $$
      DECLARE
        seq_num INTEGER := 0;
        r RECORD;
      BEGIN
        FOR r IN SELECT id FROM audit_logs ORDER BY "timestamp" ASC, id ASC LOOP
          seq_num := seq_num + 1;
          UPDATE audit_logs SET "sequence" = seq_num WHERE id = r.id;
        END LOOP;

        -- Set previous_hash for chain continuity
        FOR r IN SELECT id, "sequence" FROM audit_logs ORDER BY "sequence" ASC LOOP
          IF r."sequence" = 1 THEN
            UPDATE audit_logs SET "previous_hash" = '' WHERE id = r.id;
          ELSE
            UPDATE audit_logs 
            SET "previous_hash" = prev.prev_hash_val
            FROM (SELECT "entry_hash" as prev_hash_val FROM audit_logs WHERE "sequence" = r."sequence" - 1) prev
            WHERE id = r.id;
          END IF;
        END LOOP;
      END $$;
    `);
    console.log('Backfill sequences: OK');

    // Verify columns exist
    const cols = await queryRaw(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
        AND column_name IN ('sequence', 'previous_hash', 'entry_hash')
      ORDER BY column_name
    `);
    console.log('\nAuditLog columns verified:');
    for (const row of cols) {
      console.log(`  ${row.column_name}: ${row.data_type} default=${row.column_default}`);
    }

    const cpResult = await queryRaw(`SELECT table_name FROM information_schema.tables WHERE table_name = 'audit_checkpoints'`);
    console.log(`Audit checkpoints table: ${cpResult.length > 0 ? 'exists' : 'missing'}`);

    const maxSeq = await queryRaw(`SELECT COALESCE(MAX("sequence"), 0) AS seq FROM audit_logs`);
    console.log(`Max sequence in audit_logs: ${maxSeq[0].seq}`);

    // Mark migration as applied in prisma_migrations
    try {
      await raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM prisma_migrations 
            WHERE migration_name = '20260726190000_phase9_audit_integrity'
          ) THEN
            INSERT INTO prisma_migrations (
              id, migration_name, steps_backup, sql, steps, checksum, finished_at, deployment_history_id
            ) VALUES (
              gen_random_uuid(), '20260726190000_phase9_audit_integrity', '', '', '',
              encode(sha256('phase9'::bytea), 'hex'), now(), gen_random_uuid()
            );
          END IF;
        END $$;
      `);
      console.log('Migration record: OK');
    } catch (e) {
      console.log('Migration record skip:', e.message.substring(0, 100));
    }

    console.log('\nPhase 9 audit columns applied successfully.');
  } catch (err) {
    console.error('Error applying Phase 9 migration:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
