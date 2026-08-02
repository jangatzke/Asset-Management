const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '..');
const prismaDir = path.join(backendRoot, 'prisma');
const postgresSchemaPath = path.join(prismaDir, 'schema.prisma');
const sqlServerSchemaPath = path.join(prismaDir, 'schema.sqlserver.prisma');

dotenv.config({ path: path.join(backendRoot, '.env'), override: false });

function normalizeProvider(value) {
  const normalized = String(value || 'postgresql').trim().toLowerCase();
  if (['postgresql', 'postgres', 'pg'].includes(normalized)) return 'postgresql';
  if (['sqlserver', 'mssql', 'microsoft-sql-server'].includes(normalized)) return 'sqlserver';
  throw new Error(`Unsupported DB_PROVIDER "${value}". Supported values are "postgresql" and "sqlserver".`);
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL_FILE && process.env.DATABASE_URL_FILE.trim()) {
    const configuredPath = process.env.DATABASE_URL_FILE.trim();
    const secretPath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(backendRoot, configuredPath);
    const url = fs.readFileSync(secretPath, 'utf8').trim();
    if (!url) throw new Error('DATABASE_URL_FILE points to an empty secret file.');
    process.env.DATABASE_URL = url;
  }

  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    throw new Error('DATABASE_URL is missing. Set DATABASE_URL or DATABASE_URL_FILE.');
  }
}

function buildSqlServerSchema() {
  const source = fs.readFileSync(postgresSchemaPath, 'utf8');
  let schema = source.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlserver"');

  const enumNames = [...schema.matchAll(/^enum\s+(\w+)\s+{[\s\S]*?^}\s*$/gm)].map((match) => match[1]);
  schema = schema.replace(/^enum\s+\w+\s+{[\s\S]*?^}\s*\r?\n?/gm, '');
  for (const enumName of enumNames) {
    schema = schema.replace(new RegExp(`\\b${enumName}\\b`, 'g'), 'String');
  }

  schema = schema.replace(/\bJson(\?)?(\s+@default\("(?:\\.|[^"])*"\))?/g, (_match, optional, defaultValue) => {
    const requiredDefault = optional ? '' : (defaultValue || ' @default("{}")');
    return `String${optional || ''}${requiredDefault} @db.NVarChar(Max)`;
  });

  schema = schema.replace(/\bString\[\](\s+@default\(\[\]\))?/g, 'String @default("[]") @db.NVarChar(Max)');
  schema = schema.replace(/@db\.Text\b/g, '@db.NVarChar(Max)');
  schema = schema.replace(/\s+@@index\(\[events\]\)\r?\n/g, '\n');
  schema = schema.replace(/onDelete:\s*(Cascade|SetNull|Restrict|SetDefault|NoAction)/g, 'onDelete: NoAction');
  schema = schema.replace(/@relation\(([^\n)]*?)\)/g, (match, body) => {
    if (!body.includes('fields:')) return match;
    if (body.includes('onUpdate:')) return match;
    return `@relation(${body}, onUpdate: NoAction)`;
  });

  const header = [
    '// -----------------------------------------------------------------------------',
    '// AUTO-GENERATED SQL Server Prisma schema.',
    '// Source: prisma/schema.prisma. Generator: scripts/prisma-provider.cjs.',
    '// Do not edit by hand; rerun `npm run db:schema:sqlserver` after schema changes.',
    '// Json and scalar-list fields are stored as NVARCHAR(MAX) JSON text for SQL Server.',
    '// -----------------------------------------------------------------------------',
    '',
  ].join('\n');

  fs.writeFileSync(sqlServerSchemaPath, `${header}${schema}`, 'utf8');
}

function quoteShellArg(value) {
  if (process.platform !== 'win32') return value;
  return /^[A-Za-z0-9_./:;=-]+$/.test(value) ? value : `"${String(value).replace(/"/g, '\\"')}"`;
}

function runPrisma(args) {
  const command = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
  const child = spawnSync(
    process.platform === 'win32' ? [command, ...args].map(quoteShellArg).join(' ') : command,
    process.platform === 'win32' ? [] : args,
    { cwd: backendRoot, env: process.env, stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (child.error) throw child.error;
  process.exit(child.status || 0);
}

try {
  const provider = normalizeProvider(process.env.DB_PROVIDER);
  resolveDatabaseUrl();
  if (provider === 'sqlserver') buildSqlServerSchema();

  const args = process.argv.slice(2);
  if (args[0] === 'schema-path') {
    console.log(provider === 'sqlserver' ? sqlServerSchemaPath : postgresSchemaPath);
    process.exit(0);
  }
  if (args[0] === 'build-sqlserver-schema') {
    buildSqlServerSchema();
    console.log(`Wrote ${path.relative(backendRoot, sqlServerSchemaPath)}`);
    process.exit(0);
  }

  const schemaPath = provider === 'sqlserver' ? sqlServerSchemaPath : postgresSchemaPath;
  runPrisma([...args, '--schema', schemaPath]);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
