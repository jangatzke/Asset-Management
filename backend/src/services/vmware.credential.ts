/**
 * VMware Credential Service
 *
 * Manages encrypted credentials for VMware vCenter authentication.
 * Passwords are encrypted with AES-256-CBC before storage.
 */

import { prisma } from '../config/database';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';

const ENCRYPTION_KEY = (process.env.VMWARE_ENCRYPTION_KEY || 'default-32-byte-key-for-dev!!').padEnd(32, '0').slice(0, 32);
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  if (!ivHex || !encrypted) {
    throw new AppError('Invalid encrypted data format', 500);
  }
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
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
