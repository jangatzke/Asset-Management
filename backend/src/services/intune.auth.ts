/**
 * Intune Authentication Service
 * 
 * Certificate-based authentication with Microsoft Entra ID.
 * Uses RSA-SHA256 signed JWT tokens exchanged for access tokens
 * via the Microsoft OAuth2 token endpoint.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import axios from 'axios';

export interface IntuneAuthConfig {
  tenantId: string;
  appId: string;
  certPath: string;
  certThumbprint: string;
}

export interface TokenCache {
  accessToken: string;
  expiresAt: Date;
}

export class IntuneAuthError extends Error {
  public readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'IntuneAuthError';
    this.code = code;
  }
}

/**
 * Load PEM certificate from file path
 */
async function loadCertificate(certPath: string): Promise<crypto.KeyObject> {
  try {
    const fs = await import('fs');
    const certContent = fs.readFileSync(certPath, 'utf8');
    
    // Try to parse as PEM certificate
    if (certContent.includes('BEGIN CERTIFICATE')) {
      return crypto.createPublicKey({ key: certContent, format: 'pem' });
    }
    
    // Try to parse as private key (for JWT signing)
    if (certContent.includes('BEGIN PRIVATE KEY') || certContent.includes('BEGIN RSA PRIVATE KEY')) {
      return crypto.createPrivateKey({ key: certContent, format: 'pem' });
    }
    
    throw new IntuneAuthError('Invalid certificate format', 'INVALID_CERT');
  } catch (error) {
    if (error instanceof IntuneAuthError) throw error;
    throw new IntuneAuthError(`Failed to load certificate: ${(error as Error).message}`, 'CERT_LOAD_ERROR');
  }
}

/**
 * Create a JWT signed with the service principal's certificate
 */
async function createSignedJwt(
  tenantId: string,
  appId: string,
  cert: crypto.KeyObject
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: appId,
    sub: appId,
    aud: 'https://login.microsoftonline.com/' + tenantId + '/oauth2/token',
    exp: now + 300, // 5 minutes
    iat: now,
    jti: crypto.randomBytes(16).toString('hex'), // unique nonce
  };

  // jsonwebtoken expects a Buffer or string for signing
  let privateKey: Buffer;
  
  // Determine key type and export as PKCS1/PEM
  try {
    const keyType = (cert as any).type as string;
    if (keyType === 'public') {
      // If we have a public key, we need to extract the private key from the cert chain
      // For certificate-based auth, the cert file should contain the private key
      throw new IntuneAuthError('Expected private key but got public key. Please use a PEM file containing the private key.', 'PRIVATE_KEY_REQUIRED');
    }
    // It's a private key
    privateKey = Buffer.from(cert.export({ format: 'pem', type: 'pkcs1' }) as Buffer);
  } catch {
    // Try to export as private key anyway
    try {
      privateKey = Buffer.from(cert.export({ format: 'pem', type: 'pkcs1' }) as Buffer);
    } catch {
      throw new IntuneAuthError('Failed to export private key. Ensure the certificate file contains a valid private key.', 'KEY_EXPORT_ERROR');
    }
  }

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    issuer: appId,
    subject: appId,
  });
}

/**
 * Exchange certificate for access token from Microsoft token endpoint
 *
 * For certificate-based auth with MS Entra ID:
 * 1. Create a JWT signed with the private key
 * 2. POST to token endpoint with client_id and client_cert_secret (the JWT)
 */
async function exchangeToken(
  tenantId: string,
  appId: string,
  jwtToken: string
): Promise<TokenCache> {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  try {
    const response = await axios.post(
      tokenEndpoint,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: appId,
        client_secret: jwtToken, // The signed JWT acts as the client_secret
        resource: 'https://graph.microsoft.com',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      }
    );

    const data = response.data;
    
    if (!data.access_token) {
      throw new IntuneAuthError('No access token in response', 'TOKEN_EXCHANGE_FAILED');
    }

    // Token validity is typically 60 minutes, refresh 5 minutes before expiry
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    return {
      accessToken: data.access_token,
      expiresAt,
    };
  } catch (error) {
    if (error instanceof IntuneAuthError) throw error;
    if (axios.isAxiosError(error)) {
      throw new IntuneAuthError(
        `Token exchange failed: ${error.response?.statusText || error.message}`,
        'TOKEN_EXCHANGE_ERROR'
      );
    }
    throw new IntuneAuthError(`Token exchange failed: ${(error as Error).message}`, 'TOKEN_EXCHANGE_ERROR');
  }
}

export class IntuneAuthService {
  private config: IntuneAuthConfig;
  private tokenCache: TokenCache | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private certKey: crypto.KeyObject | null = null;

  constructor(config: IntuneAuthConfig) {
    this.config = config;
  }

  /**
   * Initialize the auth service (load certificate)
   */
  async initialize(): Promise<void> {
    this.certKey = await loadCertificate(this.config.certPath);
    // Force initial token fetch
    await this.refreshAccessToken();
    console.log('[IntuneAuth] Service initialized successfully');
  }

  /**
   * Get a valid access token (auto-refreshes if needed)
   */
  async getAccessToken(): Promise<string> {
    if (!this.certKey) {
      throw new IntuneAuthError('Auth service not initialized. Call initialize() first.', 'NOT_INITIALIZED');
    }

    // Check if cached token is still valid
    if (this.tokenCache && new Date() < this.tokenCache.expiresAt) {
      return this.tokenCache.accessToken;
    }

    // Token needs refresh
    return this.refreshAccessToken();
  }

  /**
   * Refresh the access token
   */
  async refreshAccessToken(): Promise<string> {
    if (!this.certKey) {
      throw new IntuneAuthError('Auth service not initialized. Call initialize() first.', 'NOT_INITIALIZED');
    }

    console.log('[IntuneAuth] Refreshing access token...');

    const jwtToken = await createSignedJwt(
      this.config.tenantId,
      this.config.appId,
      this.certKey
    );

    const tokenData = await exchangeToken(
      this.config.tenantId,
      this.config.appId,
      jwtToken
    );

    this.tokenCache = tokenData;

    // Schedule next refresh 5 minutes before expiry
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    const refreshIn = Math.max(0, (this.tokenCache.expiresAt.getTime() - Date.now()) - 300000);
    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken().catch((err) => {
        console.error('[IntuneAuth] Scheduled token refresh failed:', err);
      });
    }, refreshIn);

    console.log('[IntuneAuth] Access token refreshed successfully');
    return this.tokenCache.accessToken;
  }

  /**
   * Get token expiry time
   */
  getTokenExpiry(): Date | null {
    return this.tokenCache?.expiresAt ?? null;
  }

  /**
   * Check if token is valid
   */
  isTokenValid(): boolean {
    if (!this.tokenCache) return false;
    return new Date() < this.tokenCache.expiresAt;
  }

  /**
   * Get current auth status
   */
  getStatus(): {
    isInitialized: boolean;
    isTokenValid: boolean;
    tokenExpiry: Date | null;
    tenantId: string;
    appId: string;
  } {
    return {
      isInitialized: !!this.certKey,
      isTokenValid: this.isTokenValid(),
      tokenExpiry: this.getTokenExpiry(),
      tenantId: this.config.tenantId,
      appId: this.config.appId,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.tokenCache = null;
    this.certKey = null;
  }
}

// Singleton instance (initialized via config)
let authService: IntuneAuthService | null = null;

export function getAuthService(): IntuneAuthService | null {
  return authService;
}

export function initializeAuthService(config: IntuneAuthConfig): IntuneAuthService {
  authService = new IntuneAuthService(config);
  return authService;
}
