import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { authorizationService, type EffectiveRoleAssignment } from './authorization.service';
import {
  SEARCH_ENTITY_TYPES,
  type GlobalSearchResponse,
  type SearchEntityType,
  type SearchGroup,
  type SearchResultItem,
} from 'shared';

export interface GlobalSearchQuery {
  q: string;
  /** Max hits per category (top hits in grouped mode). */
  limit?: number;
  /** Restrict to a single category ("show all of this category"). */
  type?: SearchEntityType;
  /** Offset within a single category for paging. */
  offset?: number;
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;
/** Truncate long text fields before returning them as subtitles. */
const SNIPPET_LENGTH = 140;

function snippet(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return undefined;
  return clean.length > SNIPPET_LENGTH ? `${clean.slice(0, SNIPPET_LENGTH)}…` : clean;
}

/** Case-insensitive trigram search across the given columns. */
function containsAny(query: string, fields: string[]): Prisma.InputJsonObject {
  const needle = query.trim();
  return {
    OR: fields.map((field) => ({ [field]: { contains: needle, mode: 'insensitive' } })),
  } as Prisma.InputJsonObject;
}

interface SearchHandler {
  entityType: SearchEntityType;
  /** Base where-clause for this type (excludes archived records). */
  baseWhere(): Prisma.InputJsonObject;
  searchFields: string[];
  select: Record<string, boolean>;
  map(row: any): SearchResultItem;
}

const NOT_ARCHIVED = { isArchived: false } as const;

const HANDLERS: Record<SearchEntityType, SearchHandler> = {
  assets: {
    entityType: 'assets',
    baseWhere: () => ({ ...NOT_ARCHIVED }),
    searchFields: ['name', 'description', 'serialNumber', 'displayId', 'inventoryNumber', 'manufacturer', 'model'],
    select: { id: true, name: true, displayId: true, description: true },
    map: (row) => ({
      id: row.id, entityType: 'assets', title: row.name, displayId: row.displayId,
      subtitle: snippet(row.description), route: `/assets/${row.id}`,
    }),
  },
  tickets: {
    entityType: 'tickets',
    baseWhere: () => ({ ...NOT_ARCHIVED }),
    searchFields: ['title', 'description', 'displayId'],
    select: { id: true, title: true, displayId: true, description: true },
    map: (row) => ({
      id: row.id, entityType: 'tickets', title: row.title, displayId: row.displayId,
      subtitle: snippet(row.description), route: `/tickets/${row.id}`,
    }),
  },
  incidents: {
    entityType: 'incidents',
    baseWhere: () => ({ ...NOT_ARCHIVED }),
    searchFields: ['title', 'description', 'displayId'],
    select: { id: true, title: true, displayId: true, description: true },
    map: (row) => ({
      id: row.id, entityType: 'incidents', title: row.title, displayId: row.displayId,
      subtitle: snippet(row.description), route: `/incidents/${row.id}`,
    }),
  },
  risks: {
    entityType: 'risks',
    baseWhere: () => ({ ...NOT_ARCHIVED }),
    searchFields: ['title', 'description', 'displayId'],
    select: { id: true, title: true, displayId: true, description: true },
    map: (row) => ({
      id: row.id, entityType: 'risks', title: row.title, displayId: row.displayId,
      subtitle: snippet(row.description), route: `/risks/${row.id}`,
    }),
  },
  controls: {
    entityType: 'controls',
    baseWhere: () => ({ ...NOT_ARCHIVED }),
    searchFields: ['title', 'description', 'controlGoal'],
    select: { id: true, title: true, description: true },
    // Controls have no dedicated detail route; link to the list filtered by title.
    map: (row) => ({
      id: row.id, entityType: 'controls', title: row.title, displayId: null,
      subtitle: snippet(row.description), route: `/controls?search=${encodeURIComponent(row.title)}`,
    }),
  },
  contracts: {
    entityType: 'contracts',
    baseWhere: () => ({ ...NOT_ARCHIVED }),
    searchFields: ['title', 'description', 'displayId'],
    select: { id: true, title: true, displayId: true, description: true },
    map: (row) => ({
      id: row.id, entityType: 'contracts', title: row.title, displayId: row.displayId,
      subtitle: snippet(row.description), route: `/contracts?search=${encodeURIComponent(row.title)}`,
    }),
  },
  licenses: {
    entityType: 'licenses',
    baseWhere: () => ({ ...NOT_ARCHIVED }),
    searchFields: ['title', 'description', 'displayId', 'vendor', 'licenseKey'],
    select: { id: true, title: true, displayId: true, description: true },
    map: (row) => ({
      id: row.id, entityType: 'licenses', title: row.title, displayId: row.displayId,
      subtitle: snippet(row.description), route: `/licenses?search=${encodeURIComponent(row.title)}`,
    }),
  },
  suppliers: {
    entityType: 'suppliers',
    baseWhere: () => ({ ...NOT_ARCHIVED }),
    searchFields: ['legalName', 'description', 'displayId', 'contactPerson', 'contactEmail'],
    select: { id: true, legalName: true, displayId: true, description: true },
    map: (row) => ({
      id: row.id, entityType: 'suppliers', title: row.legalName, displayId: row.displayId,
      subtitle: snippet(row.description), route: `/isms-operations/suppliers/${row.id}`,
    }),
  },
  knowledge: {
    entityType: 'knowledge',
    baseWhere: () => ({ ...NOT_ARCHIVED }),
    searchFields: ['title', 'summary', 'content'],
    select: { id: true, title: true, displayId: true, summary: true },
    map: (row) => ({
      id: row.id, entityType: 'knowledge', title: row.title, displayId: row.displayId,
      subtitle: snippet(row.summary), route: `/knowledge-base?search=${encodeURIComponent(row.title)}`,
    }),
  },
};

/** Read permission for knowledge articles mirrors documents; contracts/licenses have no
 * dedicated read permission in the matrix and are admin-gated on their routes. */
function resolveAuthzWhere(activeRoles: EffectiveRoleAssignment[], entityType: SearchEntityType): Prisma.InputJsonObject | null {
  if (entityType === 'knowledge') {
    return activeRoles.some((role) => role.permissions.has('documents.read')) ? {} : null;
  }
  if (entityType === 'contracts' || entityTypesAdminOnly(entityType)) {
    // Contract/license routes require admin access; mirror that in search.
    return activeRoles.some((role) => role.permissions.has('administration.access')) ? {} : null;
  }
  const filter = authorizationService.buildScopedReadFilterFromRoles(activeRoles, entityType as any);
  // Sentinel filters mean "no permission" – skip the category entirely.
  if ((filter as any)?.id?.equals?.startsWith?.('__phase1_')) return null;
  return filter as Prisma.InputJsonObject;
}

function entityTypesAdminOnly(entityType: SearchEntityType): boolean {
  return entityType === 'licenses';
}

// ---------------------------------------------------------------------------
// Small per-user result cache to absorb typing bursts (debounced client-side,
// but shared queries across tabs/sessions still benefit). Bounded + short TTL.
// ---------------------------------------------------------------------------
interface CacheEntry { groups: SearchGroup[]; totalCount: number; expiresAt: number }
const CACHE_TTL_MS = 15_000;
const CACHE_MAX_ENTRIES = 200;
const searchCache = new Map<string, CacheEntry>();

function cacheGet(key: string): CacheEntry | undefined {
  const entry = searchCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) { searchCache.delete(key); return undefined; }
  return entry;
}

function cacheSet(key: string, entry: Omit<CacheEntry, 'expiresAt'>): void {
  if (searchCache.size >= CACHE_MAX_ENTRIES) {
    // Evict the oldest insertion to keep the map bounded.
    const oldestKey = searchCache.keys().next().value as string | undefined;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(key, { ...entry, expiresAt: Date.now() + CACHE_TTL_MS });
}

export class SearchService {
  async search(userId: string, query: GlobalSearchQuery): Promise<GlobalSearchResponse> {
    const q = (query.q ?? '').trim();
    if (q.length < MIN_QUERY_LENGTH) {
      return { query: q, groups: [], totalCount: 0 };
    }

    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(query.offset ?? 0, 0);

    // Resolve the user's effective roles exactly once and derive per-type read
    // filters from them – a user only ever sees results they could open anyway.
    const activeRoles = await authorizationService.getActiveRoles(userId);

    const requestedTypes: SearchEntityType[] = query.type ? [query.type] : [...SEARCH_ENTITY_TYPES];
    const runnable = requestedTypes
      .map((type) => ({ type, authzWhere: resolveAuthzWhere(activeRoles, type) }))
      .filter((entry): entry is { type: SearchEntityType; authzWhere: Prisma.InputJsonObject } => entry.authzWhere !== null);

    if (runnable.length === 0) {
      return { query: q, groups: [], totalCount: 0 };
    }

    const cacheKey = `${userId}|${q.toLowerCase()}|${query.type ?? '*'}|${limit}|${offset}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return { query: q, groups: cached.groups, totalCount: cached.totalCount };
    }

    // Run all categories concurrently; each returns its count + top hits.
    const results = await Promise.all(runnable.map(async ({ type, authzWhere }) => {
      const handler = HANDLERS[type];
      const where: Prisma.InputJsonObject = { AND: [handler.baseWhere(), containsAny(q, handler.searchFields), authzWhere] };
      try {
        const [total, rows] = await Promise.all([
          (prisma as any)[modelFor(type)].count({ where }),
          (prisma as any)[modelFor(type)].findMany({
            where,
            select: handler.select,
            orderBy: [{ updatedAt: 'desc' }],
            take: limit,
            skip: offset,
          }),
        ]);
        const items: SearchResultItem[] = (rows as any[]).map((row) => handler.map(row));
        return { type, total, items };
      } catch (error) {
        // A single failing category must not break the whole search.
        console.error(`[search] category ${type} failed:`, error);
        return { type, total: 0, items: [] as SearchResultItem[] };
      }
    }));

    const groups: SearchGroup[] = results
      .filter((group) => group.total > 0)
      .map((group) => ({ entityType: group.type, total: group.total, items: group.items }))
      // Most hits first so the most relevant categories surface on top.
      .sort((a, b) => b.total - a.total);

    const totalCount = groups.reduce((sum, group) => sum + group.total, 0);
    cacheSet(cacheKey, { groups, totalCount });
    return { query: q, groups, totalCount };
  }
}

function modelFor(type: SearchEntityType): string {
  switch (type) {
    case 'assets': return 'asset';
    case 'tickets': return 'ticket';
    case 'incidents': return 'incident';
    case 'risks': return 'risk';
    case 'controls': return 'control';
    case 'contracts': return 'contract';
    case 'licenses': return 'license';
    case 'suppliers': return 'supplier';
    case 'knowledge': return 'knowledgeArticle';
    default: return type;
  }
}

export const searchService = new SearchService();
