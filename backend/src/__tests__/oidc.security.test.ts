const mockPrismaClient: any = {
  oidcConfig: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  oidcLoginState: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
  oidcAccountLink: { findUnique: jest.fn() },
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  userRole: { findMany: jest.fn(), create: jest.fn() },
  displayIdCounter: { upsert: jest.fn() },
  auditLog: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) }, // Phase 9: hash-chain lookup
  $transaction: jest.fn(async (callback: (tx: typeof mockPrismaClient) => Promise<unknown>) => callback(mockPrismaClient)),
};

jest.mock('../config/database', () => ({ prisma: mockPrismaClient }));

jest.mock('../services/auth.service', () => ({
  authService: {
    issueExternalSession: jest.fn(async (user) => ({
      state: 'authenticated',
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roles: ['employee'] },
      token: 'access-token',
      refreshToken: 'refresh-token',
      refreshTokenExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
    })),
  },
}));

import { OidcService } from '../services/oidc.service';
import { authService } from '../services/auth.service';

describe('OidcService Phase 4 security', () => {
  let oidcService: OidcService;
  const now = new Date('2026-07-26T11:00:00.000Z');
  const mockConfig = {
    id: 'config-1',
    enabled: true,
    providerName: 'entra_id',
    tenantId: 'tenant-123',
    clientId: 'client-123',
    clientSecret: null,
    clientSecretRef: 'env:OIDC_CLIENT_SECRET_TEST',
    redirectUri: 'http://localhost:3000/api/v1/auth/oidc/callback',
    allowedEmailDomains: [],
    autoProvisioning: false,
    defaultRoleForNewUsers: 'employee',
    enableGroupMapping: false,
    groupClaimToRoleMapping: {},
    enableLocalLogin: true,
    autoProvisioningRequiresApproval: false,
  };

  const openidClient: any = {
    discovery: jest.fn(async () => ({ issuer: 'issuer-config' })),
    ClientSecretBasic: jest.fn((secret: string) => ({ method: 'client_secret_basic', secret })),
    randomState: jest.fn(() => 'plain-state'),
    randomNonce: jest.fn(() => 'nonce-123'),
    randomPKCECodeVerifier: jest.fn(() => 'verifier-123'),
    calculatePKCECodeChallenge: jest.fn(async () => 'challenge-123'),
    buildAuthorizationUrl: jest.fn((_config: unknown, params: Record<string, string>) => new URL(`https://issuer.example/authorize?${new URLSearchParams(params)}`)),
    authorizationCodeGrant: jest.fn(async () => ({
      claims: () => ({ sub: 'subject-123', email: 'linked@example.com', given_name: 'Linked', family_name: 'User', tid: 'tenant-123' }),
    })),
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.OIDC_CLIENT_SECRET_TEST = 'resolved-secret';
    oidcService = new OidcService();
    oidcService.setOpenIdClientForTest(openidClient);
    mockPrismaClient.oidcConfig.findFirst.mockResolvedValue(mockConfig);
    mockPrismaClient.oidcLoginState.create.mockResolvedValue({});
    mockPrismaClient.oidcLoginState.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaClient.oidcLoginState.findUnique.mockImplementation(async ({ where }: any) => ({
      id: where.id ?? 'state-id',
      oidcConfigId: 'config-1',
      stateHash: where.stateHash ?? 'hash',
      nonce: 'nonce-123',
      codeVerifier: 'verifier-123',
      createdAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      usedAt: where.id ? now : null,
    }));
    mockPrismaClient.oidcAccountLink.findUnique.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'linked@example.com',
        firstName: 'Linked',
        lastName: 'User',
        isActive: true,
        mustChangePasswordOnNext: false,
        passwordChangedAt: now,
        oidcId: 'subject-123',
        oidcProvider: 'entra_id',
        mfaEnabled: false,
        mfaSecret: null,
        mfaPendingSecret: null,
      },
    });
  });

  afterEach(() => jest.useRealTimers());

  it('builds an authorization URL with PKCE S256, state, and nonce', async () => {
    const result = await oidcService.getAuthorizationUrl();

    expect(result.authorizeUrl).toContain('code_challenge=challenge-123');
    expect(result.authorizeUrl).toContain('code_challenge_method=S256');
    expect(result.authorizeUrl).toContain('state=plain-state');
    expect(result.authorizeUrl).toContain('nonce=nonce-123');
    expect(result.state).toBe('plain-state');
  });

  it('stores only hashed state with nonce, verifier, and a 10 minute TTL', async () => {
    await oidcService.getAuthorizationUrl();
    const data = mockPrismaClient.oidcLoginState.create.mock.calls[0][0].data;

    expect(data.stateHash).not.toBe('plain-state');
    expect(data.stateHash).toHaveLength(64);
    expect(data.nonce).toBe('nonce-123');
    expect(data.codeVerifier).toBe('verifier-123');
    expect(data.expiresAt).toEqual(new Date(now.getTime() + 10 * 60 * 1000));
  });

  it('rejects missing, expired, and reused state', async () => {
    mockPrismaClient.oidcLoginState.findUnique.mockResolvedValueOnce(null);
    await expect(oidcService.handleCallback('code', 'missing')).rejects.toThrow('Invalid state');

    mockPrismaClient.oidcLoginState.findUnique.mockResolvedValueOnce({ id: 'state-id', oidcConfigId: 'config-1', expiresAt: new Date(now.getTime() - 1), usedAt: null });
    await expect(oidcService.handleCallback('code', 'expired')).rejects.toThrow('OIDC state has expired');

    mockPrismaClient.oidcLoginState.findUnique.mockResolvedValueOnce({ id: 'state-id', oidcConfigId: 'config-1', expiresAt: new Date(now.getTime() + 1), usedAt: now });
    await expect(oidcService.handleCallback('code', 'reused')).rejects.toThrow('OIDC state has already been used');
  });

  it('rejects state replay when atomic consume update count is zero', async () => {
    mockPrismaClient.oidcLoginState.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(oidcService.handleCallback('code', 'plain-state')).rejects.toThrow('OIDC state has already been used');
    expect(openidClient.authorizationCodeGrant).not.toHaveBeenCalled();
  });

  it('allows only one concurrent callback to consume one state', async () => {
    mockPrismaClient.oidcLoginState.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const results = await Promise.allSettled([
      oidcService.handleCallback('code-one', 'plain-state'),
      oidcService.handleCallback('code-two', 'plain-state'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(openidClient.authorizationCodeGrant).toHaveBeenCalledTimes(1);
  });

  it('uses openid-client grant checks with expected state, nonce, and PKCE verifier', async () => {
    await oidcService.handleCallback('auth-code', 'plain-state');

    expect(openidClient.authorizationCodeGrant).toHaveBeenCalledWith(expect.anything(), expect.any(URL), expect.objectContaining({
      pkceCodeVerifier: 'verifier-123',
      expectedState: 'plain-state',
      expectedNonce: 'nonce-123',
      idTokenExpected: true,
    }));
  });

  it('does not auto-link an existing local account by email alone', async () => {
    mockPrismaClient.oidcAccountLink.findUnique.mockResolvedValue(null);
    mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'local-1', email: 'linked@example.com' });

    await expect(oidcService.handleCallback('auth-code', 'plain-state', undefined, { ipAddress: '127.0.0.1' })).rejects.toThrow('OIDC account is not linked');
    expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'OIDC_EMAIL_LINK_REJECTED' }) }));
  });

  it('allows a pre-linked account to receive the normal session', async () => {
    const result = await oidcService.handleCallback('auth-code', 'plain-state');

    expect(result.refreshToken).toBe('refresh-token');
    expect(authService.issueExternalSession).toHaveBeenCalled();
  });

  it('rejects tenant mismatch when tenant configuration exists', async () => {
    openidClient.authorizationCodeGrant.mockResolvedValueOnce({ claims: () => ({ sub: 'subject-123', email: 'linked@example.com', tid: 'other-tenant' }) });

    await expect(oidcService.handleCallback('auth-code', 'plain-state')).rejects.toThrow('OIDC tenant mismatch');
  });

  it('resolves client secret from environment reference without plaintext config secret', async () => {
    await oidcService.getAuthorizationUrl();

    expect(openidClient.ClientSecretBasic).toHaveBeenCalledWith('resolved-secret');
    expect(mockConfig.clientSecret).toBeNull();
  });

  it('rejects authorization URL generation when redirect URI is not the backend callback path', async () => {
    mockPrismaClient.oidcConfig.findFirst.mockResolvedValueOnce({ ...mockConfig, redirectUri: 'http://localhost:5173/callback' });

    await expect(oidcService.getAuthorizationUrl()).rejects.toThrow('OIDC redirect URI must target the backend callback endpoint');
  });

  it('rejects cleartext persisted client secrets in production', () => {
    process.env.NODE_ENV = 'production';

    expect(() => oidcService.resolveClientSecret({ clientSecret: 'cleartext-secret', clientSecretRef: null })).toThrow('OIDC client secret must be provided by environment reference in production');
  });
});
