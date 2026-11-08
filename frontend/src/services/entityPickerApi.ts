import api from './api';
import type { PaginatedApiResponse } from './api';

export interface EntityPickerResult {
  id: string;
  label: string;
}

interface EntityEndpointConfig {
  url: string;
  /**
   * Query parameter name expected by the backend list endpoint.
   * Most list services filter via `search`, while the user and organization
   * unit endpoints use `q`.
   */
  searchParam: 'search' | 'q';
}

const ENDPOINT_CONFIG: Record<EntityType, EntityEndpointConfig> = {
  user: { url: '/users/owners', searchParam: 'q' },
  asset: { url: '/assets', searchParam: 'search' },
  organizationUnit: { url: '/organization/units', searchParam: 'q' },
  supplier: { url: '/isms-operations/suppliers', searchParam: 'search' },
  risk: { url: '/risks', searchParam: 'search' },
  contract: { url: '/contracts', searchParam: 'search' },
  control: { url: '/controls', searchParam: 'search' },
  businessProcess: { url: '/processes', searchParam: 'search' },
  bcp: { url: '/isms-operations/bcps', searchParam: 'search' },
  bia: { url: '/isms-operations/bias', searchParam: 'search' },
  requirement: { url: '/frameworks/requirements', searchParam: 'search' },
  evidence: { url: '/evidence', searchParam: 'search' },
  trainingCourse: { url: '/training-courses', searchParam: 'search' },
  workflowDefinition: { url: '/isms-operations/workflowDefinitions', searchParam: 'search' },
  auditPlan: { url: '/isms-operations/auditPlans', searchParam: 'search' },
  managementReview: { url: '/isms-operations/managementReviews', searchParam: 'search' },
  incident: { url: '/incidents', searchParam: 'search' },
};

/**
 * Detail endpoints that do not share the list URL prefix. The users picker
 * searches `/users/owners` (active only) but a single user is fetched via
 * the admin-guarded `/users/:id` route.
 */
const DETAIL_URL_OVERRIDES: Partial<Record<EntityType, string>> = {
  user: '/users',
};

/**
 * Fetch entities for the EntityPicker component.
 * Each entity type uses a different API endpoint with consistent response format.
 */
export async function fetchEntities(
  entityType: EntityType,
  query: string,
  page = 1,
  limit = 20
): Promise<{ items: EntityPickerResult[]; hasMore: boolean }> {
  const config = ENDPOINT_CONFIG[entityType];
  if (!config) {
    // Fallback for types without dedicated search
    return { items: [], hasMore: false };
  }

  const params: Record<string, unknown> = { [config.searchParam]: query, page, limit };

  const response = await api.get<PaginatedApiResponse<any> | any[]>(config.url, { params });
  const isArrayResponse = Array.isArray(response.data);
  const responseData = response.data as PaginatedApiResponse<any>;
  // PaginatedApiResponse uses .data property; raw arrays are the data itself
  const data: Record<string, unknown>[] = isArrayResponse ? (response.data as any[]) : ((responseData as any)?.data ?? []);

  const items: EntityPickerResult[] = data
    // The owner endpoint already filters inactive users, but keep this
    // defensive check so any future endpoint change cannot surface inactive
    // accounts in the picker.
    .filter((item: Record<string, unknown>) => entityType !== 'user' || item.isActive !== false)
    .map((item: Record<string, unknown>) => ({
      id: item.id as string,
      label: getEntityLabel(item, entityType),
    }));

  // Determine hasMore from pagination info or array length.
  // Prefer the authoritative total from the pagination metadata: there are
  // more pages only when the number of items received so far is below total.
  // Falling back to "page is full" only works for non-final pages, so it is
  // used when no total is available.
  const totalFromResponse = isArrayResponse ? undefined : ((responseData as any)?.pagination?.total ?? responseData.total);
  const hasMore = typeof totalFromResponse === 'number'
    ? data.length < totalFromResponse
    : data.length >= limit;

  return { items, hasMore };
}

/**
 * Shared search adapter for EntitySearchSelect and other consumers.
 * Returns resolved options directly so every page uses the same search path.
 */
export function entitySearchEndpoint(entityType: EntityType) {
  return async (query: string): Promise<EntityPickerResult[]> => {
    if (!query || query.trim().length < 1) return [];
    const { items } = await fetchEntities(entityType, query, 1, 20);
    return items;
  };
}

/**
 * Resolve a human-readable label for an entity id. Used to hydrate picker
 * values that are loaded from persisted entity data.
 */
export async function fetchEntityResult(entityType: EntityType, id: string): Promise<EntityPickerResult | null> {
  if (!id) return null;
  const baseUrl = DETAIL_URL_OVERRIDES[entityType] ?? ENDPOINT_CONFIG[entityType]?.url;
  if (!baseUrl) return null;
  try {
    const response = await api.get<Record<string, unknown>>(`${baseUrl}/${id}`);
    return { id, label: getEntityLabel(response.data, entityType) };
  } catch {
    return null;
  }
}

/**
 * Extract a display label from an entity object.
 * User records show the full name and e-mail so references are readable
 * without exposing raw UUIDs.
 */
function getEntityLabel(item: Record<string, unknown>, entityType: EntityType): string {
  const displayId = item.displayId as string | undefined;
  const name = item.name as string | undefined;
  const title = item.title as string | undefined;
  const legalName = item.legalName as string | undefined;
  const email = item.email as string | undefined;
  const fullName = item.fullName as string | undefined;
  const firstName = item.firstName as string | undefined;
  const lastName = item.lastName as string | undefined;

  if (entityType === 'user') {
    const userName = name ?? fullName ?? [firstName, lastName].filter(Boolean).join(' ');
    if (userName && email && userName !== email) return `${userName} (${email})`;
    if (userName) return userName;
    if (email) return email;
    return String(item.id ?? 'Unknown');
  }

  if (displayId && (name || title)) return `${displayId} - ${name || title}`;
  if (legalName) return legalName;
  if (name) return name;
  if (title) return title;
  if (email) return email;
  return String(item.id ?? 'Unknown');
}

export type EntityType =
  | 'user'
  | 'asset'
  | 'organizationUnit'
  | 'supplier'
  | 'risk'
  | 'contract'
  | 'control'
  | 'businessProcess'
  | 'bcp'
  | 'bia'
  | 'requirement'
  | 'evidence'
  | 'trainingCourse'
  | 'workflowDefinition'
  | 'auditPlan'
  | 'managementReview'
  | 'incident';
