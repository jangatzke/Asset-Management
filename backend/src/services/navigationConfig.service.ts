import { NAVIGATION_HREFS } from 'shared';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface NavigationConfigDto {
  id?: string;
  navOrder: string[];
  hiddenEntries: string[];
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Global (system-wide) default order for the top navigation. Modeled after
 * authSettings.service.ts: a singleton row created lazily with an empty
 * navOrder, which means "use the built-in catalog order".
 */
export class NavigationConfigService {
  async getConfig(): Promise<NavigationConfigDto> {
    const existing = await (prisma as any).navigationConfig.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existing) return this.normalizeRow(existing);
    const created = await (prisma as any).navigationConfig.create({ data: { navOrder: [] } });
    return this.normalizeRow(created);
  }

  async updateConfig(
    navOrder: unknown,
    updatedBy?: string,
    hiddenEntries?: unknown,
  ): Promise<NavigationConfigDto> {
    if (!Array.isArray(navOrder)) {
      throw new AppError('navOrder must be an array of navigation hrefs', 400);
    }
    const known = new Set<string>(NAVIGATION_HREFS);
    const cleaned: string[] = [];
    for (const entry of navOrder) {
      if (typeof entry !== 'string' || !known.has(entry)) {
        throw new AppError('navOrder contains an unknown navigation entry', 400);
      }
      if (!cleaned.includes(entry)) cleaned.push(entry);
    }
    let cleanedHidden: string[] | undefined;
    if (hiddenEntries !== undefined) {
      if (!Array.isArray(hiddenEntries)) {
        throw new AppError('hiddenEntries must be an array of navigation hrefs', 400);
      }
      cleanedHidden = [];
      for (const entry of hiddenEntries) {
        if (typeof entry !== 'string' || !known.has(entry)) {
          throw new AppError('hiddenEntries contains an unknown navigation entry', 400);
        }
        if (!cleanedHidden.includes(entry)) cleanedHidden.push(entry);
      }
    }
    const current = await this.getConfig();
    const updated = await (prisma as any).navigationConfig.update({
      where: { id: current.id },
      data: {
        navOrder: cleaned,
        ...(cleanedHidden !== undefined ? { hiddenEntries: cleanedHidden } : {}),
        updatedBy: updatedBy ?? null,
      },
    });
    return this.normalizeRow(updated);
  }

  /** Reset the global default back to the built-in catalog order and visibility. */
  async resetConfig(updatedBy?: string): Promise<NavigationConfigDto> {
    const current = await this.getConfig();
    const updated = await (prisma as any).navigationConfig.update({
      where: { id: current.id },
      data: { navOrder: [], hiddenEntries: [], updatedBy: updatedBy ?? null },
    });
    return this.normalizeRow(updated);
  }

  private normalizeRow(row: any): NavigationConfigDto {
    return {
      id: row?.id,
      navOrder: this.parseStringArray(row?.navOrder),
      hiddenEntries: this.parseStringArray(row?.hiddenEntries),
      updatedBy: row?.updatedBy ?? null,
      createdAt: row?.createdAt,
      updatedAt: row?.updatedAt,
    };
  }

  private parseStringArray(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.filter((entry: unknown): entry is string => typeof entry === 'string');
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((entry: unknown): entry is string => typeof entry === 'string');
        }
      } catch {
        // fall through to empty
      }
    }
    return [];
  }
}

export const navigationConfigService = new NavigationConfigService();
