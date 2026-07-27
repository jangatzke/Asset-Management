require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const cols = await p.$queryRaw`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='audit_logs' AND column_name IN ('sequence', 'previous_hash', 'entry_hash') ORDER BY column_name`;
    console.log('AuditLog columns:');
    for (const c of cols) {
      console.log(`  ${c.column_name}: ${c.data_type} default=${c.column_default}`);
    }

    const max = await p.$queryRaw`SELECT COALESCE(MAX("sequence"),0) AS seq FROM audit_logs`;
    console.log('Max sequence:', max[0].seq);

    const cp = await p.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_name='audit_checkpoints'`;
    console.log('Audit checkpoints table:', cp.length > 0 ? 'exists' : 'missing');

    await p.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    await p.$disconnect();
    process.exit(1);
  }
})();
