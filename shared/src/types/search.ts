// Shared DTOs for the global full-text search feature.

export const SEARCH_ENTITY_TYPES = [
  'assets',
  'tickets',
  'incidents',
  'risks',
  'controls',
  'contracts',
  'licenses',
  'suppliers',
  'knowledge',
] as const;

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

/** A single search hit returned by the global search endpoint. */
export interface SearchResultItem {
  id: string;
  entityType: SearchEntityType;
  /** Primary display label (name / title / legal name). */
  title: string;
  /** Human-readable identifier such as ASSET-0001, when available. */
  displayId?: string | null;
  /** Short snippet or secondary line (description excerpt, type info…). */
  subtitle?: string | null;
  /** Route path the frontend should navigate to for this hit. */
  route: string;
}

/** Grouped search results – one entry per entity type that has hits. */
export interface SearchGroup {
  entityType: SearchEntityType;
  total: number;
  items: SearchResultItem[];
}

export interface GlobalSearchResponse {
  query: string;
  groups: SearchGroup[];
  /** Total number of matched records across all authorized types. */
  totalCount: number;
}
