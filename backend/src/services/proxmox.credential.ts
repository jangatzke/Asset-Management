/**
 * Proxmox Credential Service
 *
 * Manages encrypted credentials for Proxmox VE authentication.
 * Supports both password-based and API token authentication.
 * Passwords and tokens are encrypted with authenticated AES-256-GCM before
 * storage. Legacy AES-256-CBC values remain readable (backward compatible).
 *
 * Key handling is fail-closed: the service refuses to run when
 * PROXMOX_ENCRYPTION_KEY is missing or not exactly 32 characters.
 */

import { prisma } from '../config/database';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';

const ENCRYPTION_KEY_ENV = 'PROXMOX_ENCRYPTION_KEY';
const LEGACY_ALGORITHM = 'aes-256-cbc';

function resolveEncryptionKey(): Buffer {
  const rawKey = process.env[ENCRYPTION_KEY_ENV];
  if (!rawKey) {
    throw new AppError(
      `${ENCRYPTION_KEY_ENV} is not set. Set it to a 32-character secret before starting the server.`,
      500,
      true
    );
  }
  if (rawKey.length !== 32) {
    throw new AppError(
      `${ENCRYPTION_KEY_ENV} must be exactly 32 characters long (got ${rawKey.length}).`,
      500,
      true
    );
  }
  return Buffer.from(rawKey, 'utf8');
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Output format: `<ivHex>:<authTagHex>:<ciphertextHex>` (three parts).
 */
function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const key = resolveEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a stored value.
 * Supports both:
 *  - new format:  `<ivHex>:<authTagHex>:<ciphertextHex>` (AES-256-GCM)
 *  - legacy:      `<ivHex>:<ciphertextHex>` (AES-256-CBC)
 *
 * Note: legacy values were also written under the old VMWARE_ENCRYPTION_KEY
 * env var; if the stored data was written with that key, set both
 * PROXMOX_ENCRYPTION_KEY and (legacy) VMWARE_ENCRYPTION_KEY accordingly.
 */
function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  const key = resolveEncryptionKey();

  if (parts.length === 3) {
    const [ivHex, authTagHex, ciphertextHex] = parts;
    if (!ivHex || !authTagHex || !ciphertextHex) {
      throw new AppError('Invalid encrypted data format', 500);
    }
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  if (parts.length === 2) {
    const [ivHex, ciphertextHex] = parts;
    if (!ivHex || !ciphertextHex) {
      throw new AppError('Invalid encrypted data format', 500);
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, key, iv);
    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  throw new AppError('Invalid encrypted data format', 500);
}

export interface ProxmoxCredentialDto {
  id: string;
  name: string;
  username: string;
  hasPassword: boolean;
  hasApiToken: boolean;
  isDefault: boolean;
  proxmoxServerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ProxmoxCredentialService {
  async listCredentials(): Promise<ProxmoxCredentialDto[]> {
    const credentials = await prisma.proxmoxCredential.findMany({
      include: {
        _count: {
          select: { proxmoxServers: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return credentials.map((c) => ({
      id: c.id,
      name: c.name,
      username: c.username,
      hasPassword: !!c.passwordEncrypted,
      hasApiToken: !!c.apiToken,
      isDefault: c.isDefault,
      proxmoxServerCount: c._count.proxmoxServers,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async getCredential(id: string) {
    return prisma.proxmoxCredential.findUnique({
      where: { id },
      include: {
        _count: {
          select: { proxmoxServers: true },
        },
      },
    });
  }

  async createCredential(data: {
    name: string;
    username: string;
    password?: string;
    apiToken?: string;
  }): Promise<ProxmoxCredentialDto> {
    if (!data.password && !data.apiToken) {
      throw new AppError('Either password or API token is required', 400);
    }

    // If this is set as default, unset any existing defaults
    if (data.name.toLowerCase().includes('default') || data.username.toLowerCase().includes('default')) {
      await prisma.proxmoxCredential.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const createData: any = {
      name: data.name,
      username: data.username,
      isDefault: false,
    };

    if (data.password) {
      createData.passwordEncrypted = encrypt(data.password);
    }
    if (data.apiToken) {
      createData.apiToken = encrypt(data.apiToken);
    }

    const credential = await prisma.proxmoxCredential.create({
      data: createData,
      include: {
        _count: {
          select: { proxmoxServers: true },
        },
      },
    });

    return this.mapToDto(credential);
  }

  async updateCredential(
    id: string,
    data: { name?: string; username?: string; password?: string; apiToken?: string; isDefault?: boolean }
  ): Promise<ProxmoxCredentialDto> {
    const existing = await prisma.proxmoxCredential.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Credential not found', 404);
    }

    // If setting this as default, unset others
    if (data.isDefault) {
      await prisma.proxmoxCredential.updateMany({
        where: { id: { not: id }, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.password !== undefined) {
      updateData.passwordEncrypted = encrypt(data.password);
    }
    if (data.apiToken !== undefined) {
      updateData.apiToken = encrypt(data.apiToken);
    }

    const credential = await prisma.proxmoxCredential.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { proxmoxServers: true },
        },
      },
    });

    return this.mapToDto(credential);
  }

  async deleteCredential(id: string): Promise<{ message: string }> {
    const credential = await prisma.proxmoxCredential.findUnique({
      where: { id },
      include: { _count: { select: { proxmoxServers: true } } },
    });

    if (!credential) {
      throw new AppError('Credential not found', 404);
    }

    if (credential._count.proxmoxServers > 0) {
      throw new AppError('Cannot delete credential still in use by Proxmox servers', 400);
    }

    await prisma.proxmoxCredential.delete({ where: { id } });
    return { message: 'Credential deleted successfully' };
  }

  /**
   * Get decrypted credentials for a given credential ID.
   * Returns whichever auth method is available (password or API token).
   */
  async getDecryptedCredentials(id: string): Promise<{
    username: string;
    password?: string;
    apiToken?: string;
  }> {
    const credential = await prisma.proxmoxCredential.findUnique({ where: { id } });
    if (!credential) {
      throw new AppError('Credential not found', 404);
    }

    const result: { username: string; password?: string; apiToken?: string } = {
      username: credential.username,
    };

    if (credential.passwordEncrypted) {
      result.password = decrypt(credential.passwordEncrypted);
    }
    if (credential.apiToken) {
      result.apiToken = decrypt(credential.apiToken);
    }

    return result;
  }

  async getDefaultCredential(): Promise<ProxmoxCredentialDto | null> {
    const credential = await prisma.proxmoxCredential.findFirst({
      where: { isDefault: true },
      include: {
        _count: {
          select: { proxmoxServers: true },
        },
      },
    });

    if (!credential) return null;

    return this.mapToDto(credential);
  }

  private mapToDto(credential: any): ProxmoxCredentialDto {
    return {
      id: credential.id,
      name: credential.name,
      username: credential.username,
      hasPassword: !!credential.passwordEncrypted,
      hasApiToken: !!credential.apiToken,
      isDefault: credential.isDefault,
      proxmoxServerCount: credential._count?.proxmoxServers || 0,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }
}

export const proxmoxCredentialService = new ProxmoxCredentialService();
