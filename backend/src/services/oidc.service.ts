import crypto from 'crypto';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { AuthSessionResult, SessionContext, authService } from './auth.service';

type OpenIdClientModule = typeof import('openid-client', { with: { 'resolution-mode': 'import' } });

export interface OidcConfigData {
  enabled?: boolean;
  providerName?: string;
  tenantId?: string;
  clientId?: string;
  clientSecretRef?: string;
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
  email?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  groups?: string[];
  tid?: string;
}

type OidcRuntimeConfig = {
  id: string;
  enabled: boolean;
  providerName: string;
  tenantId: string | null;
  clientId: string | null;
  clientSecretRef?: string | null;
  clientSecret?: string | null;
  redirectUri: string | null;
  allowedEmailDomains: unknown;
  autoProvisioning: boolean;
  defaultRoleForNewUsers: string;
  enableGroupMapping: boolean;
  groupClaimToRoleMapping: unknown;
  enableLocalLogin: boolean;
  autoProvisioningRequiresApproval?: boolean;
};

type OidcLinkedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  mustChangePasswordOnNext: boolean;
  passwordChangedAt: Date;
  oidcId: string | null;
  oidcProvider: string | null;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaPendingSecret: string | null;
};

type AuthorizationResult = { authorizeUrl: string; state: string };

export class OidcService {
  private readonly stateTtlMs = 10 * 60 * 1000;
  private openidClientForTest?: OpenIdClientModule;

  setOpenIdClientForTest(openidClient: OpenIdClientModule | undefined): void {
    if (process.env.NODE_ENV !== 'test') throw new AppError('Test OpenID client injection is not available', 500);
    this.openidClientForTest = openidClient;
  }

  private async openidClient(): Promise<OpenIdClientModule> {
    if (this.openidClientForTest) return this.openidClientForTest;
    return import('openid-client');
  }

  private stateHash(state: string): string {
    return crypto.createHash('sha256').update(state).digest('hex');
  }

  private jsonArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private jsonRecord(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  }

  private issuerUrl(config: OidcRuntimeConfig): URL {
    if (!config.tenantId) throw new AppError('OIDC not configured', 400);
    if (config.tenantId.startsWith('https://')) return new URL(config.tenantId);
    return new URL(`https://login.microsoftonline.com/${config.tenantId}/v2.0`);
  }

  resolveClientSecret(config: Pick<OidcRuntimeConfig, 'clientSecretRef' | 'clientSecret'>): string | undefined {
    if (config.clientSecretRef) {
      if (!config.clientSecretRef.startsWith('env:')) throw new AppError('Unsupported OIDC client secret reference', 500);
      const envName = config.clientSecretRef.slice('env:'.length);
      const value = process.env[envName];
      if (!value) throw new AppError('OIDC client secret reference could not be resolved', 500);
      return value;
    }
    if (process.env.NODE_ENV === 'production' && config.clientSecret) {
      throw new AppError('OIDC client secret must be provided by environment reference in production', 500);
    }
    return config.clientSecret || undefined;
  }

  private async clientConfiguration(config: OidcRuntimeConfig) {
    if (!config.clientId || !config.redirectUri) throw new AppError('OIDC not configured', 400);
    const client = await this.openidClient();
    const clientSecret = this.resolveClientSecret(config);
    const metadata = { redirect_uris: [config.redirectUri], response_types: ['code'] };
    if (clientSecret) {
      return client.discovery(this.issuerUrl(config), config.clientId, metadata, client.ClientSecretBasic(clientSecret));
    }
    return client.discovery(this.issuerUrl(config), config.clientId, metadata);
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
          autoProvisioningRequiresApproval: false,
        },
      });
    }
    return config;
  }

  async updateConfig(data: OidcConfigData): Promise<any> {
    let config = await prisma.oidcConfig.findFirst();
    if (!config) config = await this.getConfig();

    const updateData: Record<string, unknown> = {};
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.providerName) updateData.providerName = data.providerName;
    if (data.tenantId !== undefined) updateData.tenantId = data.tenantId;
    if (data.clientId !== undefined) updateData.clientId = data.clientId;
    if (data.clientSecretRef !== undefined) updateData.clientSecretRef = data.clientSecretRef;
    if (data.clientSecret !== undefined) {
      if (process.env.NODE_ENV === 'production' && data.clientSecret) throw new AppError('OIDC client secret must be provided by environment reference in production', 400);
      updateData.clientSecret = data.clientSecret;
    }
    if (data.redirectUri !== undefined) updateData.redirectUri = data.redirectUri;
    if (data.allowedEmailDomains !== undefined) updateData.allowedEmailDomains = data.allowedEmailDomains;
    if (data.autoProvisioning !== undefined) updateData.autoProvisioning = data.autoProvisioning;
    if (data.defaultRoleForNewUsers) updateData.defaultRoleForNewUsers = data.defaultRoleForNewUsers;
    if (data.enableGroupMapping !== undefined) updateData.enableGroupMapping = data.enableGroupMapping;
    if (data.groupClaimToRoleMapping !== undefined) updateData.groupClaimToRoleMapping = data.groupClaimToRoleMapping;
    if (data.enableLocalLogin !== undefined) updateData.enableLocalLogin = data.enableLocalLogin;
    if (data.autoProvisioningRequiresApproval !== undefined) updateData.autoProvisioningRequiresApproval = data.autoProvisioningRequiresApproval;

    if (!config) throw new AppError('OIDC config not found', 404);
    return prisma.oidcConfig.update({ where: { id: config.id }, data: updateData as any });
  }

  async isEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enabled;
  }

  async isLocalLoginEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enableLocalLogin;
  }

  async getAuthorizationUrl(_legacyState?: string): Promise<AuthorizationResult> {
    const config = await this.getConfig() as OidcRuntimeConfig;
    if (!config.enabled || !config.tenantId || !config.clientId || !config.redirectUri) throw new AppError('OIDC not configured', 400);
    if (!config.redirectUri.includes('/auth/oidc/callback') && !config.redirectUri.includes('/api/v1/auth/oidc/callback')) throw new AppError('OIDC redirect URI must target the backend callback endpoint', 400);

    const client = await this.openidClient();
    const oidcConfig = await this.clientConfiguration(config);
    const state = client.randomState();
    const nonce = client.randomNonce();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const expiresAt = new Date(Date.now() + this.stateTtlMs);

    await prisma.oidcLoginState.create({
      data: { oidcConfigId: config.id, stateHash: this.stateHash(state), nonce, codeVerifier, expiresAt },
    });

    const authorizeUrl = client.buildAuthorizationUrl(oidcConfig, {
      redirect_uri: config.redirectUri,
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return { authorizeUrl: authorizeUrl.href, state };
  }

  private async consumeState(configId: string, state: string) {
    const stateHash = this.stateHash(state);
    const stored = await prisma.oidcLoginState.findUnique({ where: { stateHash } });
    if (!stored || stored.oidcConfigId !== configId) throw new AppError('Invalid state', 401);
    if (stored.usedAt) throw new AppError('OIDC state has already been used', 401);
    if (stored.expiresAt.getTime() <= Date.now()) throw new AppError('OIDC state has expired', 401);
    const consumed = await prisma.oidcLoginState.updateMany({ where: { id: stored.id, oidcConfigId: configId, stateHash, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) throw new AppError('OIDC state has already been used', 401);
    return stored;
  }

  private callbackUrl(config: OidcRuntimeConfig, code: string, state: string): URL {
    if (!config.redirectUri) throw new AppError('OIDC not configured', 400);
    const url = new URL(config.redirectUri);
    url.searchParams.set('code', code);
    url.searchParams.set('state', state);
    return url;
  }

  private claimsToUserInfo(claims: Record<string, unknown>): OidcUserInfo {
    const sub = typeof claims.sub === 'string' ? claims.sub : '';
    if (!sub) throw new AppError('OIDC subject missing', 401);
    return {
      sub,
      email: typeof claims.email === 'string' ? claims.email : typeof claims.preferred_username === 'string' ? claims.preferred_username : undefined,
      given_name: typeof claims.given_name === 'string' ? claims.given_name : undefined,
      family_name: typeof claims.family_name === 'string' ? claims.family_name : undefined,
      name: typeof claims.name === 'string' ? claims.name : undefined,
      groups: this.jsonArray(claims.groups),
      tid: typeof claims.tid === 'string' ? claims.tid : undefined,
    };
  }

  private enforceTenant(config: OidcRuntimeConfig, userInfo: OidcUserInfo): void {
    if (config.tenantId && !config.tenantId.startsWith('https://') && userInfo.tid && userInfo.tid !== config.tenantId) {
      throw new AppError('OIDC tenant mismatch', 401);
    }
  }

  private enforceEmailDomain(config: OidcRuntimeConfig, email: string): void {
    const allowedDomains = this.jsonArray(config.allowedEmailDomains).map((domain) => domain.toLowerCase());
    if (allowedDomains.length === 0) return;
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain || !allowedDomains.includes(emailDomain)) throw new AppError('Email domain not allowed', 403);
  }

  private async auditRejectedEmailLink(email: string, subject: string, context: SessionContext): Promise<void> {
    await auditService.logEventStandalone(prisma, {
      userId: 'system',
      action: 'OIDC_EMAIL_LINK_REJECTED',
      entityType: 'User',
      entityId: 'unknown',
      details: `Rejected OIDC login for existing local account without provider-subject link: ${email} (${subject})`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  private async linkedUser(config: OidcRuntimeConfig, subject: string): Promise<OidcLinkedUser | null> {
    const db = prisma as any;
    const link = await db.oidcAccountLink.findUnique({
      where: { oidcConfigId_subject: { oidcConfigId: config.id, subject } },
      include: { user: true },
    });
    return (link?.user ?? null) as OidcLinkedUser | null;
  }

  private async provisionExternalUser(config: OidcRuntimeConfig, userInfo: OidcUserInfo): Promise<OidcLinkedUser> {
    if (!config.autoProvisioning) throw new AppError('Auto-provisioning is disabled. User not found.', 403);
    if (config.autoProvisioningRequiresApproval) throw new AppError('Auto-provisioning requires approval. Please contact your administrator.', 403);
    if (!userInfo.email) throw new AppError('OIDC email claim missing', 401);

    const existing = await prisma.user.findUnique({ where: { email: userInfo.email } });
    if (existing) throw new AppError('OIDC account is not linked to this existing local user', 403);

    const counter = await prisma.displayIdCounter.upsert({
      where: { entityType: 'User' },
      create: { entityType: 'User', sequence: 1 },
      update: { sequence: { increment: 1 } },
    });
    const userDisplayId = `USR-${String(counter.sequence).padStart(4, '0')}`;
    const firstName = userInfo.given_name || userInfo.name || 'User';
    const lastName = userInfo.family_name || '';

    const db = prisma as any;
    const user = await db.user.create({
      data: {
        displayId: userDisplayId,
        email: userInfo.email,
        passwordHash: crypto.randomBytes(32).toString('hex'),
        firstName,
        lastName,
        oidcId: userInfo.sub,
        oidcProvider: config.providerName,
        oidcAccountLinks: { create: { oidcConfigId: config.id, providerName: config.providerName, subject: userInfo.sub } },
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleName: config.defaultRoleForNewUsers || 'employee' } });
    if (config.enableGroupMapping && userInfo.groups) {
      const mapping = this.jsonRecord(config.groupClaimToRoleMapping);
      for (const group of userInfo.groups) {
        if (mapping[group]) {
          try {
            await prisma.userRole.create({ data: { userId: user.id, roleName: mapping[group] } });
          } catch (error) {
            await auditService.logEventStandalone(prisma, {
              userId: user.id,
              userName: `${user.firstName} ${user.lastName}`,
              action: 'OIDC_GROUP_ROLE_MAPPING_SKIPPED',
              entityType: 'User',
              entityId: user.id,
              details: `Skipped duplicate or invalid OIDC group role mapping for group ${group}: ${error instanceof Error ? error.message : 'unknown error'}`,
            });
          }
        }
      }
    }
    return user as OidcLinkedUser;
  }

  async handleCallback(code: string, state: string, _legacyCodeVerifier?: string, context: SessionContext = {}): Promise<AuthSessionResult & { state: 'authenticated' }> {
    if (!code || !state) throw new AppError('OIDC callback missing code or state', 400);
    const config = await this.getConfig() as OidcRuntimeConfig;
    if (!config.enabled || !config.tenantId || !config.clientId || !config.redirectUri) throw new AppError('OIDC not configured', 400);

    const stored = await this.consumeState(config.id, state);
    const oidcConfig = await this.clientConfiguration(config);
    const client = await this.openidClient();
    const tokens = await client.authorizationCodeGrant(oidcConfig, this.callbackUrl(config, code, state), {
      pkceCodeVerifier: stored.codeVerifier,
      expectedState: state,
      expectedNonce: stored.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) throw new AppError('OIDC ID token claims missing', 401);
    const userInfo = this.claimsToUserInfo(claims as Record<string, unknown>);
    this.enforceTenant(config, userInfo);
    if (!userInfo.email) throw new AppError('OIDC email claim missing', 401);
    this.enforceEmailDomain(config, userInfo.email);

    let user = await this.linkedUser(config, userInfo.sub);
    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: userInfo.email } });
      if (existingByEmail) {
        await this.auditRejectedEmailLink(userInfo.email, userInfo.sub, context);
        throw new AppError('OIDC account is not linked to this existing local user', 403);
      }
      user = await this.provisionExternalUser(config, userInfo);
    }

    if (!user.isActive) throw new AppError('User account is disabled', 403);
    if (!user.oidcId || user.oidcId !== userInfo.sub || user.oidcProvider !== config.providerName) {
      await prisma.user.update({ where: { id: user.id }, data: { oidcId: userInfo.sub, oidcProvider: config.providerName } });
      user = { ...user, oidcId: userInfo.sub };
    }
    return authService.issueExternalSession(user, context, 'OIDC_LOGIN');
  }
}

export const oidcService = new OidcService();
