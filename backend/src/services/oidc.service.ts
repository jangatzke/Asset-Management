import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export interface OidcConfigData {
  enabled?: boolean;
  providerName?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  allowedEmailDomains?: string[];
  autoProvisioning?: boolean;
  defaultRoleForNewUsers?: string;
  enableGroupMapping?: boolean;
  groupClaimToRoleMapping?: Record<string, string>;
  enableLocalLogin?: boolean;
  autoProvisioningRequiresApproval?: boolean;
}

export interface OidcUserInfo {
  sub: string;
  email: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  groups?: string[];
}

export class OidcService {
  // In-memory store for state/nonce and PKCE code verifier
  private stateNonceStore = new Map<string, { nonce: string; codeVerifier: string; codeChallenge: string }>();

  // Helper to base64url encode a buffer
  private base64urlEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Helper to compute SHA256 hash
  private sha256(message: string): Buffer {
    return crypto.createHash('sha256').update(message).digest();
  }

  async getConfig(): Promise<any> {
    let config = await prisma.oidcConfig.findFirst();
    if (!config) {
      config = await prisma.oidcConfig.create({
        data: {
          enabled: false,
          providerName: 'entra_id',
          allowedEmailDomains: [],
          autoProvisioning: false,
          defaultRoleForNewUsers: 'employee',
          enableGroupMapping: false,
          groupClaimToRoleMapping: {},
          enableLocalLogin: true,
        },
      });
    }
    return config;
  }

  async updateConfig(data: OidcConfigData): Promise<any> {
    let config = await prisma.oidcConfig.findFirst();
    if (!config) {
      config = await this.getConfig();
    }

    const updateData: any = {};
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.providerName) updateData.providerName = data.providerName;
    if (data.tenantId !== undefined) updateData.tenantId = data.tenantId;
    if (data.clientId !== undefined) updateData.clientId = data.clientId;
    if (data.clientSecret !== undefined) updateData.clientSecret = data.clientSecret;
    if (data.redirectUri !== undefined) updateData.redirectUri = data.redirectUri;
    if (data.allowedEmailDomains !== undefined) updateData.allowedEmailDomains = data.allowedEmailDomains;
    if (data.autoProvisioning !== undefined) updateData.autoProvisioning = data.autoProvisioning;
    if (data.defaultRoleForNewUsers) updateData.defaultRoleForNewUsers = data.defaultRoleForNewUsers;
    if (data.enableGroupMapping !== undefined) updateData.enableGroupMapping = data.enableGroupMapping;
    if (data.groupClaimToRoleMapping !== undefined) updateData.groupClaimToRoleMapping = data.groupClaimToRoleMapping;
    if (data.enableLocalLogin !== undefined) updateData.enableLocalLogin = data.enableLocalLogin;
    if (data.autoProvisioningRequiresApproval !== undefined) updateData.autoProvisioningRequiresApproval = data.autoProvisioningRequiresApproval;

    if (!config) throw new AppError('OIDC config not found', 404);
    return await prisma.oidcConfig.update({
      where: { id: config!.id },
      data: updateData,
    });
  }

  async isEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enabled;
  }

  async isLocalLoginEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enableLocalLogin;
  }

  async getAuthorizationUrl(state: string): Promise<string> {
    const config = await this.getConfig();
    if (!config.enabled || !config.tenantId || !config.clientId) {
      throw new AppError('OIDC not configured', 400);
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('hex');
    const codeChallenge = this.base64urlEncode(this.sha256(codeVerifier));
    
    // Generate nonce
    const nonce = crypto.randomUUID();
    
    // Store state, nonce, and codeVerifier for later validation
    this.stateNonceStore.set(state, { nonce, codeVerifier, codeChallenge });

    const baseUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`;
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri || '',
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${baseUrl}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string, codeVerifier: string): Promise<any> {
    const config = await this.getConfig();
    if (!config.enabled || !config.clientId || !config.clientSecret || !config.redirectUri || !config.tenantId) {
      throw new AppError('OIDC not configured', 400);
    }

    // Retrieve stored state, nonce, and codeVerifier
    const stored = this.stateNonceStore.get(state);
    if (!stored) {
      throw new AppError('Invalid state', 401);
    }
    const { codeChallenge: storedCodeChallenge } = stored;

    // Remove the entry to prevent reuse
    this.stateNonceStore.delete(state);

    // Validate code_verifier matches stored challenge
    const computedChallenge = this.base64urlEncode(this.sha256(codeVerifier));
    if (computedChallenge !== storedCodeChallenge) {
      throw new AppError('Invalid code verifier', 401);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      throw new AppError('OIDC token exchange failed', 401);
    }

    const tokens: any = await tokenResponse.json();

    // Get user info from Microsoft Graph
    const userResponse = await fetch('https://graph.microsoft.com/oidc/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) {
      throw new AppError('Failed to fetch user info from OIDC', 401);
    }

    const userInfo: OidcUserInfo = await userResponse.json() as OidcUserInfo;

    // Validate email domain
    if (config.allowedEmailDomains && config.allowedEmailDomains.length > 0) {
      const emailDomain = userInfo.email.split('@')[1]?.toLowerCase();
      const allowed = config.allowedEmailDomains.map((d: string) => d.toLowerCase());
      if (!allowed.includes(emailDomain)) {
        throw new AppError('Email domain not allowed', 403);
      }
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: userInfo.email },
      include: { userRoles: true },
    });

    if (user) {
      // Link existing user to OIDC
      if (!user.oidcId) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            oidcId: userInfo.sub,
            oidcProvider: config.providerName,
          },
        });
      }
      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const roles = await prisma.userRole.findMany({ where: { userId: user.id } });
      const groupRoles = await this.getGroupRolesForUser(user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: [...new Set([...roles.map((r) => r.roleName), ...groupRoles])],
        },
        token: this.generateToken(user.id, [...new Set([...roles.map((r) => r.roleName), ...groupRoles])]),
      };
    } else if (config.autoProvisioning) {
      // Check if auto-provisioning requires approval
      if (config.autoProvisioningRequiresApproval) {
        throw new AppError('Auto-provisioning requires approval. Please contact your administrator.', 403);
      }
      
      // Auto-provision new user
      const firstName = userInfo.given_name || userInfo.name || 'User';
      const lastName = userInfo.family_name || '';
      const defaultRole = config.defaultRoleForNewUsers || 'employee';

      const newUser = await prisma.user.create({
        data: {
          displayId: `USR-${Date.now()}`,
          email: userInfo.email,
          passwordHash: crypto.randomUUID(), // Placeholder, OIDC user won't use local password
          firstName,
          lastName,
          oidcId: userInfo.sub,
          oidcProvider: config.providerName,
        },
      });

      await prisma.userRole.create({
        data: {
          userId: newUser.id,
          roleName: defaultRole,
        },
      });

      // Handle group mapping if enabled
      if (config.enableGroupMapping && userInfo.groups && config.groupClaimToRoleMapping) {
        const mapping = config.groupClaimToRoleMapping as Record<string, string>;
        for (const group of userInfo.groups) {
          if (mapping[group]) {
            try {
              await prisma.userRole.create({
                data: {
                  userId: newUser.id,
                  roleName: mapping[group],
                },
              });
            } catch {
              // Skip if role doesn't exist
            }
          }
        }
      }

      const roles = await prisma.userRole.findMany({ where: { userId: newUser.id } });

      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          roles: roles.map((r) => r.roleName),
        },
        token: this.generateToken(newUser.id, roles.map((r) => r.roleName)),
      };
    } else {
      throw new AppError('Auto-provisioning is disabled. User not found.', 403);
    }
  }

  async getGroupRolesForUser(userId: string): Promise<string[]> {
    const userGroups = await prisma.userGroup.findMany({
      where: { userId },
      include: { group: { include: { groupRoles: true } } },
    });

    const roles: string[] = [];
    for (const ug of userGroups) {
      for (const gr of ug.group.groupRoles) {
        if (!roles.includes(gr.roleName)) {
          roles.push(gr.roleName);
        }
      }
    }
    return roles;
  }

  private generateToken(userId: string, roles: string[]): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError('JWT_SECRET is not configured', 500);
    }
    return jwt.sign({ userId, roles }, secret, { expiresIn: '1h' });
  }
}

export const oidcService = new OidcService();
