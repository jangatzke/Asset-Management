import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface AuthSettingsDto {
  id?: string;
  passwordComplexityEnabled: boolean;
  minPasswordLength: number;
  passwordHistoryCount: number;
  passwordValidityDays: number;
  forceMfa: boolean;
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export const DEFAULT_AUTH_SETTINGS: Omit<AuthSettingsDto, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'> = {
  passwordComplexityEnabled: true,
  minPasswordLength: 12,
  passwordHistoryCount: 0,
  passwordValidityDays: 0,
  forceMfa: false,
};

export class AuthSettingsService {
  async getSettings(): Promise<AuthSettingsDto> {
    const existing = await (prisma as any).authSettings.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existing) return existing;
    return await (prisma as any).authSettings.create({ data: DEFAULT_AUTH_SETTINGS });
  }

  async updateSettings(data: Partial<AuthSettingsDto>, updatedBy?: string): Promise<AuthSettingsDto> {
    const current = await this.getSettings();
    const updateData = this.normalizeSettings(data, updatedBy);
    return await (prisma as any).authSettings.update({ where: { id: current.id }, data: updateData });
  }

  validatePassword(password: string, settings: AuthSettingsDto): PasswordValidationResult {
    const errors: string[] = [];
    if (password.length < settings.minPasswordLength) {
      errors.push(`Password must be at least ${settings.minPasswordLength} characters long`);
    }
    if (settings.passwordComplexityEnabled) {
      if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
      if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
      if (!/[0-9]/.test(password)) errors.push('Password must contain at least one digit');
      if (!/[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/`~]/.test(password)) errors.push('Password must contain at least one special character');
    }
    return { valid: errors.length === 0, errors };
  }

  async ensurePasswordAllowedForLocalUser(userId: string | null, password: string): Promise<void> {
    const settings = await this.getSettings();
    const validation = this.validatePassword(password, settings);
    if (!validation.valid) {
      throw new AppError(`Password does not meet security requirements: ${validation.errors.join(', ')}`, 400);
    }
    if (userId && settings.passwordHistoryCount > 0) {
      const history = await (prisma as any).passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: settings.passwordHistoryCount,
      });
      for (const entry of history) {
        if (await bcrypt.compare(password, entry.passwordHash)) {
          throw new AppError(`Password was used recently and cannot be reused for the last ${settings.passwordHistoryCount} password(s)`, 400);
        }
      }
    }
  }

  async recordPasswordHash(userId: string, passwordHash: string): Promise<void> {
    const settings = await this.getSettings();
    if (settings.passwordHistoryCount <= 0) return;
    await (prisma as any).passwordHistory.create({ data: { userId, passwordHash } });
    const keep = await (prisma as any).passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: settings.passwordHistoryCount,
      select: { id: true },
    });
    if (keep.length > 0) {
      await (prisma as any).passwordHistory.deleteMany({ where: { id: { in: keep.map((entry: { id: string }) => entry.id) } } });
    }
  }

  isPasswordExpired(passwordChangedAt: Date | string | null | undefined, settings: AuthSettingsDto): boolean {
    if (!settings.passwordValidityDays || settings.passwordValidityDays <= 0 || !passwordChangedAt) return false;
    const changedAt = new Date(passwordChangedAt).getTime();
    const maxAgeMs = settings.passwordValidityDays * 24 * 60 * 60 * 1000;
    return Date.now() - changedAt > maxAgeMs;
  }

  private normalizeSettings(data: Partial<AuthSettingsDto>, updatedBy?: string): Partial<AuthSettingsDto> {
    const normalized: Partial<AuthSettingsDto> = {};
    if (data.passwordComplexityEnabled !== undefined) normalized.passwordComplexityEnabled = Boolean(data.passwordComplexityEnabled);
    if (data.forceMfa !== undefined) normalized.forceMfa = Boolean(data.forceMfa);
    if (data.minPasswordLength !== undefined) normalized.minPasswordLength = this.clampInt(data.minPasswordLength, 1, 128, 'Minimum password length');
    if (data.passwordHistoryCount !== undefined) normalized.passwordHistoryCount = this.clampInt(data.passwordHistoryCount, 0, 24, 'Password history count');
    if (data.passwordValidityDays !== undefined) normalized.passwordValidityDays = this.clampInt(data.passwordValidityDays, 0, 3650, 'Password validity days');
    normalized.updatedBy = updatedBy ?? null;
    return normalized;
  }

  private clampInt(value: unknown, min: number, max: number, label: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new AppError(`${label} must be an integer between ${min} and ${max}`, 400);
    }
    return parsed;
  }
}

export const authSettingsService = new AuthSettingsService();
