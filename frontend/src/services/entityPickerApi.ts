import api from './api';
import type { PaginatedApiResponse } from './api';

export interface EntityPickerResult {
  id: string;
  label: string;
}

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
  const params: Record<string, unknown> = { q: query, page, limit };

  let url: string;
  switch (entityType) {
    case 'user':
      url = '/users/search';
      break;
    case 'asset':
      url = '/assets';
      params.limit = limit;
      break;
    case 'organizationUnit':
      url = '/organization/units';
      params.limit = limit;
      break;
    case 'supplier':
      url = '/isms-operations/suppliers';
      params.limit = limit;
      break;
    case 'risk':
      url = '/risks';
      params.limit = limit;
      break;
    case 'contract':
      url = '/contracts';
      params.limit = limit;
      break;
    case 'control':
      url = '/controls';
      params.limit = limit;
      break;
    case 'businessProcess':
      url = '/processes';
      params.limit = limit;
      break;
    case 'bcp':
      url = '/isms-operations/bcps';
      params.limit = limit;
      break;
    case 'bia':
      url = '/isms-operations/bias';
      params.limit = limit;
      break;
    case 'requirement':
      url = '/frameworks/requirements';
      params.limit = limit;
      break;
    case 'evidence':
      url = '/evidence';
      break;
    default:
      // Fallback for types without dedicated search
      return { items: [], hasMore: false };
  }

  const response = await api.get<PaginatedApiResponse<any> | any[]>(url, { params });
  const isArrayResponse = Array.isArray(response.data);
  const responseData = response.data as PaginatedApiResponse<any>;
  // PaginatedApiResponse uses .data property; raw arrays are the data itself
  const data: Record<string, unknown>[] = isArrayResponse ? (response.data as any[]) : ((responseData as any)?.data ?? []);

  const items: EntityPickerResult[] = data.map((item: Record<string, unknown>) => ({
    id: item.id as string,
    label: getEntityLabel(item),
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
 * Extract a display label from an entity object.
 */
function getEntityLabel(item: Record<string, unknown>): string {
  const displayId = item.displayId as string | undefined;
  const name = item.name as string | undefined;
  const title = item.title as string | undefined;
  const legalName = item.legalName as string | undefined;
  const email = item.email as string | undefined;

  if (displayId && (name || title)) {
    return `${displayId} - ${name || title}`;
  }
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
  | 'evidence';
