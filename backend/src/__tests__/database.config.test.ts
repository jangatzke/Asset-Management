describe('database configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts PostgreSQL configuration and redacts the URL from safe output', async () => {
    process.env.DB_PROVIDER = 'postgresql';
    process.env.DATABASE_URL = 'postgresql://user:secret@localhost:5432/app?schema=public';
    delete process.env.DATABASE_URL_FILE;

    const { getDatabaseRuntimeConfig, getSafeDatabaseConfig } = await import('../config/database');

    expect(getDatabaseRuntimeConfig().provider).toBe('postgresql');
    expect(getSafeDatabaseConfig()).not.toHaveProperty('databaseUrl');
  });

  it('accepts SQL Server URL shape and exposes the concrete Prisma runtime path', async () => {
    process.env.DB_PROVIDER = 'sqlserver';
    process.env.DATABASE_URL = 'sqlserver://localhost:1433;database=asset_management;user=asset_user;password=secret;encrypt=true';
    delete process.env.DATABASE_URL_FILE;

    const { getDatabaseRuntimeConfig, getSafeDatabaseConfig } = await import('../config/database');
    const config = getDatabaseRuntimeConfig();

    expect(config.provider).toBe('sqlserver');
    expect(config.prismaSchema).toBe('prisma/schema.sqlserver.prisma');
    expect(config.jsonCompatibilityMode).toBe('nvarchar-json-text');
    expect(config.limitations.join(' ')).toContain('NVARCHAR(MAX) JSON text');
    expect(config.limitations.join(' ')).not.toContain('does not support Json fields');
    expect(getSafeDatabaseConfig()).not.toHaveProperty('databaseUrl');
  });

  it('rejects mismatched provider and URL scheme', async () => {
    process.env.DB_PROVIDER = 'sqlserver';
    process.env.DATABASE_URL = 'postgresql://user:secret@localhost:5432/app';
    delete process.env.DATABASE_URL_FILE;

    await expect(import('../config/database')).rejects.toThrow('DB_PROVIDER=sqlserver requires DATABASE_URL');
  });
});
