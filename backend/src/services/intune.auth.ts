/**
 * Intune Authentication Service
 *
 * Uses MSAL Node with certificate-based application authentication. Secrets are
 * loaded through a small SecretStore abstraction so tests can inject providers
 * and production can use environment/file-backed secret references without
 * embedding defaults.
 */

import fs from 'fs/promises';
import path from 'path';
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';

export interface IntuneAuthConfig {
  tenantId: string;
  appId: string;
  certificateThumbprint: string;
  certificatePrivateKeySecretRef: string;
  certificateX5cSecretRef?: string;
}

export interface TokenCache {
  accessToken: string;
  expiresAt: Date;
}

export interface SecretStore {
  getSecret(reference: string): Promise<string>;
}

export class IntuneAuthError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'IntuneAuthError';
    this.code = code;
  }
}

export class EnvSecretStore implements SecretStore {
  async getSecret(reference: string): Promise<string> {
    const key = reference.startsWith('env:') ? reference.slice(4) : reference;
    const value = process.env[key];
    if (!value) throw new IntuneAuthError(`Secret environment variable ${key} is not configured`, 'SECRET_NOT_FOUND');
    return value;
  }
}

export class FileSecretStore implements SecretStore {
  async getSecret(reference: string): Promise<string> {
    const filePath = reference.startsWith('file:') ? reference.slice(5) : reference;
    if (!filePath || path.isAbsolute(filePath) === false && filePath.includes('..')) {
      throw new IntuneAuthError('Invalid certificate secret file path', 'INVALID_SECRET_REFERENCE');
    }
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      throw new IntuneAuthError(`Unable to read certificate secret file: ${(error as Error).message}`, 'SECRET_READ_FAILED');
    }
  }
}

export class CompositeSecretStore implements SecretStore {
  private readonly envStore = new EnvSecretStore();
  private readonly fileStore = new FileSecretStore();

  async getSecret(reference: string): Promise<string> {
    if (!reference) throw new IntuneAuthError('Secret reference is required', 'SECRET_REFERENCE_REQUIRED');
    if (reference.startsWith('env:')) return this.envStore.getSecret(reference);
    if (reference.startsWith('file:')) return this.fileStore.getSecret(reference);
    throw new IntuneAuthError('Secret reference must use env: or file: provider', 'UNSUPPORTED_SECRET_PROVIDER');
  }
}

export class IntuneAuthService {
  private readonly config: IntuneAuthConfig;
  private readonly secretStore: SecretStore;
  private client: ConfidentialClientApplication | null = null;
  private tokenCache: TokenCache | null = null;

  constructor(config: IntuneAuthConfig, secretStore: SecretStore = new CompositeSecretStore()) {
    this.config = config;
    this.secretStore = secretStore;
  }

  async initialize(): Promise<void> {
    const privateKey = await this.secretStore.getSecret(this.config.certificatePrivateKeySecretRef);
    const x5c = this.config.certificateX5cSecretRef
      ? await this.secretStore.getSecret(this.config.certificateX5cSecretRef)
      : undefined;

    const msalConfig: Configuration = {
      auth: {
        clientId: this.config.appId,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
        clientCertificate: {
          thumbprint: this.config.certificateThumbprint,
          privateKey,
          x5c,
        },
      },
      system: {
        loggerOptions: {
          piiLoggingEnabled: false,
          loggerCallback: () => undefined,
        },
      },
    };

    this.client = new ConfidentialClientApplication(msalConfig);
    await this.refreshAccessToken();
  }

  async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt.getTime() - Date.now() > 300_000) {
      return this.tokenCache.accessToken;
    }
    return this.refreshAccessToken();
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.client) throw new IntuneAuthError('Auth service not initialized', 'NOT_INITIALIZED');

    const result = await this.client.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
      skipCache: false,
    });

    if (!result?.accessToken) throw new IntuneAuthError('MSAL did not return an access token', 'TOKEN_ACQUISITION_FAILED');

    this.tokenCache = {
      accessToken: result.accessToken,
      expiresAt: result.expiresOn ?? new Date(Date.now() + 3600_000),
    };

    return this.tokenCache.accessToken;
  }

  getTokenExpiry(): Date | null {
    return this.tokenCache?.expiresAt ?? null;
  }

  isTokenValid(): boolean {
    return !!this.tokenCache && this.tokenCache.expiresAt.getTime() > Date.now();
  }

  getStatus() {
    return {
      isInitialized: !!this.client,
      isTokenValid: this.isTokenValid(),
      tokenExpiry: this.getTokenExpiry(),
      tenantId: this.config.tenantId,
      appId: this.config.appId,
      authType: 'msal-certificate',
    };
  }

  destroy(): void {
    this.client = null;
    this.tokenCache = null;
  }
}

let authService: IntuneAuthService | null = null;

export function getAuthService(): IntuneAuthService | null {
  return authService;
}

export function initializeAuthService(config: IntuneAuthConfig, secretStore?: SecretStore): IntuneAuthService {
  authService = new IntuneAuthService(config, secretStore);
  return authService;
}

