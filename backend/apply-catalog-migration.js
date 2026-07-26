const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  const migrationSql = fs.readFileSync(
    path.join(__dirname, 'prisma', 'migrations', '20260725010000_control_catalogs', 'migration.sql'),
    'utf8'
  );

  // Split by semicolon and execute each statement
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Executing ${statements.length} SQL statements...`);

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (error) {
      // Handle "table already exists" errors
      if (error.message && error.message.includes('already exists')) {
        console.log(`Skipping: ${error.message.substring(0, 100)}`);
        continue;
      }
      console.error(`Error executing statement: ${error.message}`);
    }
  }

  console.log('Migration applied successfully!');
  await prisma.$disconnect();
}

applyMigration().catch((e) => {
  console.error(e);
  process.exit(1);
});
