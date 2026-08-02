import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('SQL Server Prisma schema support path', () => {
  const backendRoot = path.resolve(__dirname, '..', '..');
  const sqlServerSchemaPath = path.join(backendRoot, 'prisma', 'schema.sqlserver.prisma');
  const packageJsonPath = path.join(backendRoot, 'package.json');

  beforeAll(() => {
    execFileSync(process.execPath, ['scripts/prisma-provider.cjs', 'build-sqlserver-schema'], {
      cwd: backendRoot,
      env: {
        ...process.env,
        DB_PROVIDER: 'sqlserver',
        DATABASE_URL: 'sqlserver://localhost:1433;database=asset_management;user=asset_user;password=placeholder;encrypt=true',
        DATABASE_URL_FILE: '',
      },
      stdio: 'pipe',
    });
  });

  it('generates a SQL Server schema without unsupported Prisma Json, scalar list, or enum constructs', () => {
    const schema = readFileSync(sqlServerSchemaPath, 'utf8');
    const schemaWithoutComments = schema
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n');

    expect(schema).toContain('provider = "sqlserver"');
    expect(schema).toContain('AUTO-GENERATED SQL Server Prisma schema');
    expect(schemaWithoutComments).not.toMatch(/\bJson\b/);
    expect(schemaWithoutComments).not.toMatch(/\bString\[\]/);
    expect(schemaWithoutComments).not.toMatch(/^enum\s+\w+\s+{/m);
    expect(schemaWithoutComments).not.toContain('@db.Text');
    expect(schema).toContain('@db.NVarChar(Max)');
    expect(schema).toContain('onDelete: NoAction');
  });

  it('keeps provider-aware Prisma scripts available for SQL Server generation and validation', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { scripts: Record<string, string> };

    expect(packageJson.scripts['db:generate']).toBe('node scripts/prisma-provider.cjs generate');
    expect(packageJson.scripts['db:validate']).toBe('node scripts/prisma-provider.cjs validate');
    expect(packageJson.scripts['db:schema:sqlserver']).toBe('node scripts/prisma-provider.cjs build-sqlserver-schema');
    expect(packageJson.scripts['db:migrate:sqlserver']).toContain('scripts/prisma-provider.cjs migrate dev');
  });
});
