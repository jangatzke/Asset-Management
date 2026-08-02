import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

export type DatabaseProvider = 'postgresql' | 'sqlserver';

export interface DatabaseRuntimeConfig {
  provider: DatabaseProvider;
  databaseUrl: string;
  databaseUrlSource: 'DATABASE_URL' | 'DATABASE_URL_FILE';
  providerSwitchingMode: 'prisma-schema-provider';
  portableBackupFormat: 'asset-management-portable-json-v1';
  prismaSchema: string;
  jsonCompatibilityMode: 'native-json' | 'nvarchar-json-text';
  limitations: string[];
}

const SQLSERVER_RUNTIME_NOTES = [
  'SQL Server uses prisma/schema.sqlserver.prisma, generated from prisma/schema.prisma with Json and scalar list fields stored as NVARCHAR(MAX) JSON text.',
  'Runtime compatibility serializes/deserializes these JSON-backed fields at the Prisma boundary to preserve API semantics for ordinary reads and writes.',
  'Use the admin portable JSON export/import endpoints for data-preserving migrations between DBMSs; native dumps are provider-specific.',
];

type JsonCompatibilityMode = DatabaseRuntimeConfig['jsonCompatibilityMode'];

function normalizeProvider(value: string | undefined): DatabaseProvider {
  const normalized = (value ?? 'postgresql').trim().toLowerCase();
  if (['postgresql', 'postgres', 'pg'].includes(normalized)) return 'postgresql';
  if (['sqlserver', 'mssql', 'microsoft-sql-server'].includes(normalized)) return 'sqlserver';
  throw new Error(`Unsupported DB_PROVIDER "${value}". Supported values are "postgresql" and "sqlserver".`);
}

function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): { url: string; source: 'DATABASE_URL' | 'DATABASE_URL_FILE' } {
  if (env.DATABASE_URL_FILE?.trim()) {
    const configuredPath = env.DATABASE_URL_FILE.trim();
    const secretPath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
    const url = fs.readFileSync(secretPath, 'utf8').trim();
    if (!url) throw new Error('DATABASE_URL_FILE points to an empty secret file.');
    return { url, source: 'DATABASE_URL_FILE' };
  }

  if (!env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is missing. Set DATABASE_URL or DATABASE_URL_FILE.');
  }

  return { url: env.DATABASE_URL.trim(), source: 'DATABASE_URL' };
}

function validateProviderUrl(provider: DatabaseProvider, databaseUrl: string): void {
  const lower = databaseUrl.toLowerCase();
  if (provider === 'postgresql' && !lower.startsWith('postgresql://') && !lower.startsWith('postgres://')) {
    throw new Error('DB_PROVIDER=postgresql requires DATABASE_URL to start with postgresql:// or postgres://.');
  }
  if (provider === 'sqlserver' && !lower.startsWith('sqlserver://')) {
    throw new Error('DB_PROVIDER=sqlserver requires DATABASE_URL to start with sqlserver://.');
  }
}

export function getDatabaseRuntimeConfig(env: NodeJS.ProcessEnv = process.env): DatabaseRuntimeConfig {
  const provider = normalizeProvider(env.DB_PROVIDER);
  const { url, source } = resolveDatabaseUrl(env);
  validateProviderUrl(provider, url);

  return {
    provider,
    databaseUrl: url,
    databaseUrlSource: source,
    providerSwitchingMode: 'prisma-schema-provider',
    portableBackupFormat: 'asset-management-portable-json-v1',
    prismaSchema: provider === 'sqlserver' ? 'prisma/schema.sqlserver.prisma' : 'prisma/schema.prisma',
    jsonCompatibilityMode: provider === 'sqlserver' ? 'nvarchar-json-text' : 'native-json',
    limitations: provider === 'sqlserver' ? SQLSERVER_RUNTIME_NOTES : [],
  };
}

export function getSafeDatabaseConfig() {
  const config = getDatabaseRuntimeConfig();
  return {
    provider: config.provider,
    databaseUrlSource: config.databaseUrlSource,
    providerSwitchingMode: config.providerSwitchingMode,
    portableBackupFormat: config.portableBackupFormat,
    prismaSchema: config.prismaSchema,
    jsonCompatibilityMode: config.jsonCompatibilityMode,
    limitations: config.limitations,
  };
}

function discoverJsonCompatibilityFields(mode: JsonCompatibilityMode): Map<string, Set<string>> {
  if (mode !== 'nvarchar-json-text') return new Map();

  const schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const fields = new Map<string, Set<string>>();
  const modelRegex = /model\s+(\w+)\s+{([\s\S]*?)\n}/g;
  let modelMatch: RegExpExecArray | null;
  while ((modelMatch = modelRegex.exec(schema))) {
    const modelName = modelMatch[1];
    const body = modelMatch[2];
    const modelFields = new Set<string>();
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      const fieldMatch = /^(\w+)\s+(Json\??|String\[\])\b/.exec(trimmed);
      if (fieldMatch) modelFields.add(fieldMatch[1]);
    }
    if (modelFields.size) fields.set(modelName, modelFields);
  }
  return fields;
}

function serializeJsonBackedFields(value: unknown, fieldNames: Set<string> | undefined): unknown {
  if (!fieldNames || !value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => serializeJsonBackedFields(entry, fieldNames));
  const record = value as Record<string, unknown>;
  for (const [key, fieldValue] of Object.entries(record)) {
    if (fieldNames.has(key) && fieldValue !== null && fieldValue !== undefined && typeof fieldValue !== 'string') {
      record[key] = JSON.stringify(fieldValue);
    } else if (key === 'create' || key === 'update' || key === 'upsert' || key === 'createMany' || key === 'updateMany') {
      serializeJsonBackedFields(fieldValue, fieldNames);
    }
  }
  return record;
}

function deserializeJsonBackedFields(value: unknown, fieldNames: Set<string> | undefined): unknown {
  if (!fieldNames || !value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => deserializeJsonBackedFields(entry, fieldNames));
  const record = value as Record<string, unknown>;
  for (const fieldName of fieldNames) {
    const fieldValue = record[fieldName];
    if (typeof fieldValue === 'string') {
      try {
        record[fieldName] = JSON.parse(fieldValue);
      } catch {
        // Preserve legacy/plain strings if a manually edited SQL Server row is not valid JSON.
      }
    }
  }
  return record;
}

function createPrismaClient(config: DatabaseRuntimeConfig): PrismaClient {
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  const jsonFieldsByModel = discoverJsonCompatibilityFields(config.jsonCompatibilityMode);
  if (!jsonFieldsByModel.size) return baseClient;

  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, args, query }) {
          const fieldNames = model ? jsonFieldsByModel.get(model) : undefined;
          if (fieldNames && args && 'data' in args) {
            serializeJsonBackedFields((args as { data?: unknown }).data, fieldNames);
          }
          const result = await query(args);
          return deserializeJsonBackedFields(result, fieldNames);
        },
      },
    },
  }) as unknown as PrismaClient;
}

const runtimeDatabaseConfig = getDatabaseRuntimeConfig();

process.env.DATABASE_URL = runtimeDatabaseConfig.databaseUrl;

export const prisma = createPrismaClient(runtimeDatabaseConfig);

export async function testDatabaseConnection(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

export default prisma;
