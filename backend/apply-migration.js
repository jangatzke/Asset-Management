const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:Passwort123@192.168.66.222:5432/asset_management?schema=public',
    },
  },
});

async function main() {
  try {
    // Check and add complianceRelevance column to assets
    const assetsColumns = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'complianceRelevance'
    `;
    if (assetsColumns.length === 0) {
      await prisma.$executeRaw`ALTER TABLE "assets" ADD COLUMN "complianceRelevance" BOOLEAN NOT NULL DEFAULT false`;
      console.log('Added complianceRelevance column to assets');
    } else {
      console.log('complianceRelevance column already exists in assets');
    }

    // Check and add riskMethodVersionId column to risks
    const risksColumns = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'riskMethodVersionId'
    `;
    if (risksColumns.length === 0) {
      await prisma.$executeRaw`ALTER TABLE "risks" ADD COLUMN "riskMethodVersionId" UUID`;
      console.log('Added riskMethodVersionId column to risks');
      
      // Add the foreign key constraint after the column is created
      try {
        await prisma.$executeRaw`ALTER TABLE "risks" ADD CONSTRAINT "risks_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE SET NULL`;
        console.log('Added foreign key constraint for riskMethodVersionId');
      } catch (e) {
        console.log('Foreign key constraint may already exist:', e.message);
      }
    } else {
      console.log('riskMethodVersionId column already exists in risks');
    }

    // Create index for riskMethodVersionId if not exists
    try {
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "risks_riskMethodVersionId_idx" ON "risks"("riskMethodVersionId")`;
      console.log('Created/verified index for riskMethodVersionId');
    } catch (e) {
      console.log('Index may already exist:', e.message);
    }

    // Check and add displayId column to suppliers
    const suppliersColumns = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'displayId'
    `;
    if (suppliersColumns.length === 0) {
      await prisma.$executeRaw`ALTER TABLE "suppliers" ADD COLUMN "displayId" VARCHAR NOT NULL DEFAULT ''`;
      console.log('Added displayId column to suppliers');
    } else {
      console.log('displayId column already exists in suppliers');
    }

    // Drop and recreate unique constraint for displayId on suppliers
    try {
      await prisma.$executeRaw`ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "suppliers_displayId_key"`;
      await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_displayId_key" ON "suppliers"("displayId")`;
      console.log('Recreated unique index for suppliers.displayId');
    } catch (e) {
      console.log('Unique index may already exist:', e.message);
    }

    console.log('Migration completed successfully!');
  } catch (e) {
    console.error('Migration error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
