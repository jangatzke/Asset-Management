import crypto from 'crypto';

jest.mock('crypto', () => {
  const original = jest.requireActual('crypto');
  return {
    ...original,
    randomBytes: jest.fn(),
    randomUUID: jest.fn(),
  };
});

const { randomBytes, randomUUID } = require('crypto');

const mockPrismaClient: any = {
  oidcConfig: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userRole: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  userGroup: {
    findMany: jest.fn(),
  },
};

jest.mock('../config/database', () => ({
  prisma: mockPrismaClient,
}));

global.fetch = jest.fn() as any;

import { OidcService } from '../services/oidc.service';
import { AppError } from '../middleware/errorHandler';

describe('OidcService Security', () => {
  let oidcService: OidcService;
  
  const FIXED_VERIFIER = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const FIXED_NONCE = 'fixed-nonce-uuid';

  const mockConfig = {
    id: 'config-1',
    enabled: true,
    providerName: 'entra_id',
    tenantId: 'tenant-123',
    clientId: 'client-123',
    clientSecret: 'secret-123',
    redirectUri: 'http://localhost:3000/callback',
    allowedEmailDomains: [],
    autoProvisioning: false,
    defaultRoleForNewUsers: 'employee',
    enableGroupMapping: false,
    groupClaimToRoleMapping: {},
    enableLocalLogin: true,
    autoProvisioningRequiresApproval: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    oidcService = new OidcService();
    process.env.JWT_SECRET = 'test-secret-key';
    mockPrismaClient.oidcConfig.findFirst.mockResolvedValue(mockConfig);
    
    // Mock crypto functions to return fixed values
    (randomBytes as jest.Mock).mockReturnValue(Buffer.from(FIXED_VERIFIER, 'hex'));
    (randomUUID as jest.Mock).mockReturnValue(FIXED_NONCE);
  });

  describe('getAuthorizationUrl', () => {
    it('should include state, nonce, and PKCE code_challenge in URL', async () => {
      const state = 'test-state-123';
      const url = await oidcService.getAuthorizationUrl(state);

      expect(url).toContain('state=test-state-123');
      expect(url).toContain('nonce=');
      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
    });

    it('should throw error if OIDC not configured', async () => {
      mockPrismaClient.oidcConfig.findFirst.mockResolvedValue({
        ...mockConfig,
        enabled: false,
      });

      await expect(oidcService.getAuthorizationUrl('state')).rejects.toThrow(AppError);
      await expect(oidcService.getAuthorizationUrl('state')).rejects.toThrow('OIDC not configured');
    });
  });

  describe('handleCallback', () => {
    it('should throw error for invalid state', async () => {
      const code = 'auth-code-123';
      const state = 'invalid-state';
      const codeVerifier = 'verifier-123';

      await expect(oidcService.handleCallback(code, state, codeVerifier)).rejects.toThrow(
        new AppError('Invalid state', 401)
      );
    });

    it('should throw error for invalid code_verifier', async () => {
      const state = 'valid-state';
      const code = 'auth-code-123';

      await oidcService.getAuthorizationUrl(state);

      const wrongVerifier = 'wrong-verifier-that-does-not-match';

      await expect(oidcService.handleCallback(code, state, wrongVerifier)).rejects.toThrow(
        new AppError('Invalid code verifier', 401)
      );
    });

    it('should successfully handle callback with valid state and PKCE', async () => {
      const state = 'valid-state-2';
      const code = 'auth-code-456';

      // Store the state by calling getAuthorizationUrl first
      await oidcService.getAuthorizationUrl(state);

      // Use the same verifier that was stored
      const codeVerifier = FIXED_VERIFIER;

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'token-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sub: 'user-sub-123',
            email: 'existing@example.com',
            given_name: 'Existing',
            family_name: 'User',
          }),
        });

      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
        oidcId: null,
        oidcProvider: null,
      });
      mockPrismaClient.user.update.mockResolvedValue({});
      mockPrismaClient.userRole.findMany.mockResolvedValue([{ roleName: 'employee' }]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await oidcService.handleCallback(code, state, codeVerifier);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe('existing@example.com');
    });

    it('should throw error if auto-provisioning is disabled and user does not exist', async () => {
      const state = 'valid-state-3';
      const code = 'auth-code-789';

      await oidcService.getAuthorizationUrl(state);

      const codeVerifier = FIXED_VERIFIER;

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'token-456' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sub: 'new-user-sub',
            email: 'newuser@example.com',
            given_name: 'New',
            family_name: 'User',
          }),
        });

      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(oidcService.handleCallback(code, state, codeVerifier)).rejects.toThrow(
        new AppError('Auto-provisioning is disabled. User not found.', 403)
      );
    });

    it('should throw error if auto-provisioning requires approval', async () => {
      mockPrismaClient.oidcConfig.findFirst.mockResolvedValue({
        ...mockConfig,
        autoProvisioning: true,
        autoProvisioningRequiresApproval: true,
      });

      const state = 'valid-state-4';
      const code = 'auth-code-abc';

      await oidcService.getAuthorizationUrl(state);

      const codeVerifier = FIXED_VERIFIER;

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'token-789' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sub: 'new-user-sub-2',
            email: 'newuser2@example.com',
            given_name: 'New',
            family_name: 'User',
          }),
        });

      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(oidcService.handleCallback(code, state, codeVerifier)).rejects.toThrow(
        new AppError('Auto-provisioning requires approval. Please contact your administrator.', 403)
      );
    });
  });
});
