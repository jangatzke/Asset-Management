import { NAVIGATION_HREFS } from 'shared';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface NavigationViewDto {
  id: string;
  name: string;
  ownerId: string | null; // null = global view managed by admins
  navOrder: string[];
  hiddenEntries: string[];
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ViewInput {
  name?: unknown;
  navOrder?: unknown;
  hiddenEntries?: unknown;
  isDefault?: unknown;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry: unknown): entry is string => typeof entry === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry: unknown): entry is string => typeof entry === 'string');
      }
    } catch {
      // fall through to empty
    }
  }
  return [];
}

/**
 * Saved navigation views: named combinations of entry order + hidden entries.
 * ownerId NULL marks a global view managed by admins; any other owner is a
 * private view of that user. Within each scope (global / one user) at most one
 * view may be flagged isDefault, which the service enforces transactionally.
 */
export class NavigationViewService {
  /** Views visible to a user: all global views plus the user's own views. */
  async listViewsForUser(userId: string): Promise<NavigationViewDto[]> {
    const rows = await (prisma as any).navigationView.findMany({
      where: { OR: [{ ownerId: null }, { ownerId: userId }] },
      orderBy: [{ ownerId: 'asc' }, { isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((row: any) => this.normalizeRow(row));
  }

  /** Global views only (admin management surface). */
  async listGlobalViews(): Promise<NavigationViewDto[]> {
    const rows = await (prisma as any).navigationView.findMany({
      where: { ownerId: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((row: any) => this.normalizeRow(row));
  }

  async getView(viewId: string): Promise<NavigationViewDto | null> {
    const row = await (prisma as any).navigationView.findUnique({ where: { id: viewId } });
    return row ? this.normalizeRow(row) : null;
  }

  async createView(input: ViewInput, ownerId: string | null): Promise<NavigationViewDto> {
    const name = this.validateName(input.name);
    const navOrder = this.validateHrefs(input.navOrder, 'navOrder');
    const hiddenEntries = this.validateHrefs(input.hiddenEntries, 'hiddenEntries');
    const isDefault = input.isDefault === true;

    return await prisma.$transaction(async (tx: any) => {
      if (isDefault) {
        await tx.navigationView.updateMany({
          where: { ownerId: ownerId ?? null },
          data: { isDefault: false },
        });
      }
      const created = await tx.navigationView.create({
        data: {
          name,
          ownerId: ownerId ?? null,
          navOrder,
          hiddenEntries,
          isDefault,
        },
      });
      return this.normalizeRow(created);
    });
  }

  /**
   * Update a view. Global views (ownerId null) may only be edited by admins;
   * user views only by their owner. Callers must enforce authorization.
   */
  async updateView(viewId: string, input: ViewInput): Promise<NavigationViewDto> {
    const existing = await (prisma as any).navigationView.findUnique({ where: { id: viewId } });
    if (!existing) throw new AppError('Navigation view not found', 404);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = this.validateName(input.name);
    if (input.navOrder !== undefined) data.navOrder = this.validateHrefs(input.navOrder, 'navOrder');
    if (input.hiddenEntries !== undefined) data.hiddenEntries = this.validateHrefs(input.hiddenEntries, 'hiddenEntries');
    const setDefault = input.isDefault === true && existing.isDefault !== true;

    return await prisma.$transaction(async (tx: any) => {
      if (setDefault) {
        await tx.navigationView.updateMany({
          where: { ownerId: existing.ownerId, NOT: { id: viewId } },
          data: { isDefault: false },
        });
        data.isDefault = true;
      }
      const updated = await tx.navigationView.update({ where: { id: viewId }, data });
      return this.normalizeRow(updated);
    });
  }

  async deleteView(viewId: string): Promise<void> {
    const existing = await (prisma as any).navigationView.findUnique({ where: { id: viewId } });
    if (!existing) throw new AppError('Navigation view not found', 404);
    await (prisma as any).navigationView.delete({ where: { id: viewId } });
  }

  /** Mark a view as the default within its scope (global or one user). */
  async setDefault(viewId: string): Promise<NavigationViewDto> {
    const existing = await (prisma as any).navigationView.findUnique({ where: { id: viewId } });
    if (!existing) throw new AppError('Navigation view not found', 404);
    if (existing.isDefault) return this.normalizeRow(existing);

    return await prisma.$transaction(async (tx: any) => {
      await tx.navigationView.updateMany({
        where: { ownerId: existing.ownerId, NOT: { id: viewId } },
        data: { isDefault: false },
      });
      const updated = await tx.navigationView.update({ where: { id: viewId }, data: { isDefault: true } });
      return this.normalizeRow(updated);
    });
  }

  /**
   * Resolve the view a user should currently see:
   * 1. the view explicitly selected via users.activeNavigationViewId (if it is
   *    still available to them),
   * 2. otherwise the user's default view,
   * 3. otherwise the global default view,
   * 4. otherwise null (built-in catalog with global hidden/order config).
   */
  async resolveActiveView(userId: string): Promise<NavigationViewDto | null> {
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { activeNavigationViewId: true },
    });
    if (user?.activeNavigationViewId) {
      const row = await (prisma as any).navigationView.findUnique({ where: { id: user.activeNavigationViewId } });
      if (row && (row.ownerId === null || row.ownerId === userId)) return this.normalizeRow(row);
    }
    const ownDefault = await (prisma as any).navigationView.findFirst({
      where: { ownerId: userId, isDefault: true },
    });
    if (ownDefault) return this.normalizeRow(ownDefault);
    const globalDefault = await (prisma as any).navigationView.findFirst({
      where: { ownerId: null, isDefault: true },
    });
    if (globalDefault) return this.normalizeRow(globalDefault);
    return null;
  }

  private validateName(name: unknown): string {
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
      throw new AppError('View name must be a non-empty string (max 100 characters)', 400);
    }
    return name.trim();
  }

  private validateHrefs(value: unknown, field: string): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      throw new AppError(`${field} must be an array of navigation hrefs`, 400);
    }
    const known = new Set<string>(NAVIGATION_HREFS);
    const cleaned: string[] = [];
    for (const entry of value) {
      if (typeof entry !== 'string' || !known.has(entry)) {
        throw new AppError(`${field} contains an unknown navigation entry`, 400);
      }
      if (!cleaned.includes(entry)) cleaned.push(entry);
    }
    return cleaned;
  }

  private normalizeRow(row: any): NavigationViewDto {
    return {
      id: row.id,
      name: row.name,
      ownerId: row.ownerId ?? null,
      navOrder: parseStringArray(row.navOrder),
      hiddenEntries: parseStringArray(row.hiddenEntries),
      isDefault: row.isDefault === true,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const navigationViewService = new NavigationViewService();
