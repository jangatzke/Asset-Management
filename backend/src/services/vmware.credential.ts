/**
 * VMware Credential Service
 *
 * Manages encrypted credentials for VMware vCenter authentication.
 * Passwords are encrypted with authenticated AES-256-GCM before storage.
 * Legacy AES-256-CBC values remain readable (backward compatible).
 *
 * Key handling is fail-closed: the service refuses to run when
 * VMWARE_ENCRYPTION_KEY is missing or not exactly 32 characters.
 */

import { prisma } from '../config/database';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';

const ENCRYPTION_KEY_ENV = 'VMWARE_ENCRYPTION_KEY';
const LEGACY_ALGORITHM = 'aes-256-cbc';
/**
 * Expected GCM authentication tag length in bytes.
 * Must match the tag length produced by `cipher.getAuthTag()` in encrypt()
 * (16 bytes, the NIST SP 800-38D recommended full length).
 */
const GCM_AUTH_TAG_LENGTH = 16;

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
    if (authTag.length !== GCM_AUTH_TAG_LENGTH) {
      throw new AppError('Invalid encrypted data format', 500);
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, {
      authTagLength: GCM_AUTH_TAG_LENGTH,
    });
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

export interface VmwareCredentialDto {
  id: string;
  name: string;
  username: string;
  isDefault: boolean;
  vCenterCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class VMwareCredentialService {
  async listCredentials(): Promise<VmwareCredentialDto[]> {
    const credentials = await prisma.vmwareCredential.findMany({
      include: {
        _count: {
          select: { vCenters: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return credentials.map((c) => ({
      id: c.id,
      name: c.name,
      username: c.username,
      isDefault: c.isDefault,
      vCenterCount: c._count.vCenters,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async getCredential(id: string) {
    return prisma.vmwareCredential.findUnique({
      where: { id },
      include: {
        _count: {
          select: { vCenters: true },
        },
      },
    });
  }

  async createCredential(data: { name: string; username: string; password: string }): Promise<VmwareCredentialDto> {
    // If this is set as default, unset any existing defaults
    if (data.name.toLowerCase().includes('default') || data.username.toLowerCase().includes('default')) {
      await prisma.vmwareCredential.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const encrypted = encrypt(data.password);
    const credential = await prisma.vmwareCredential.create({
      data: {
        name: data.name,
        username: data.username,
        passwordEncrypted: encrypted,
        isDefault: false,
      },
      include: {
        _count: {
          select: { vCenters: true },
        },
      },
    });

    return {
      id: credential.id,
      name: credential.name,
      username: credential.username,
      isDefault: credential.isDefault,
      vCenterCount: credential._count.vCenters,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }

  async updateCredential(
    id: string,
    data: { name?: string; username?: string; password?: string; isDefault?: boolean }
  ): Promise<VmwareCredentialDto> {
    const existing = await prisma.vmwareCredential.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Credential not found', 404);
    }

    // If setting this as default, unset others
    if (data.isDefault) {
      await prisma.vmwareCredential.updateMany({
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

    const credential = await prisma.vmwareCredential.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { vCenters: true },
        },
      },
    });

    return {
      id: credential.id,
      name: credential.name,
      username: credential.username,
      isDefault: credential.isDefault,
      vCenterCount: credential._count.vCenters,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }

  async deleteCredential(id: string): Promise<{ message: string }> {
    const credential = await prisma.vmwareCredential.findUnique({
      where: { id },
      include: { _count: { select: { vCenters: true } } },
    });

    if (!credential) {
      throw new AppError('Credential not found', 404);
    }

    if (credential._count.vCenters > 0) {
      throw new AppError('Cannot delete credential still in use by vCenter servers', 400);
    }

    await prisma.vmwareCredential.delete({ where: { id } });
    return { message: 'Credential deleted successfully' };
  }

  async getDecryptedCredentials(id: string): Promise<{ username: string; password: string }> {
    const credential = await prisma.vmwareCredential.findUnique({ where: { id } });
    if (!credential) {
      throw new AppError('Credential not found', 404);
    }

    return {
      username: credential.username,
      password: decrypt(credential.passwordEncrypted),
    };
  }

  async getDefaultCredential(): Promise<VmwareCredentialDto | null> {
    const credential = await prisma.vmwareCredential.findFirst({
      where: { isDefault: true },
      include: {
        _count: {
          select: { vCenters: true },
        },
      },
    });

    if (!credential) return null;

    return {
      id: credential.id,
      name: credential.name,
      username: credential.username,
      isDefault: credential.isDefault,
      vCenterCount: credential._count.vCenters,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }
}

export const vmwareCredentialService = new VMwareCredentialService();
