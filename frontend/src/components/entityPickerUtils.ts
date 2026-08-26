/**
 * Shared, testable helpers for the EntityPicker feature.
 *
 * These functions are extracted from the ad-hoc logic that previously only
 * existed inside the test file, so the component code and the tests share a
 * single source of truth.
 */

export interface EntityPickerResult {
  id: string;
  label: string;
}

/**
 * Maps a raw entity object (as returned by various backend endpoints) to the
 * normalized picker result format `{ id, label }`.
 *
 * Label resolution order:
 *   1. `<displayId> - <name|title>` when a displayId and a name/title exist
 *   2. legalName (suppliers)
 *   3. name
 *   4. title
 *   5. email (users)
 *   6. the raw id as last resort
 */
export function mapEntityToPickerResult(item: Record<string, unknown>): EntityPickerResult {
  const id = item.id as string;
  const displayId = item.displayId as string | undefined;
  const name = item.name as string | undefined;
  const title = item.title as string | undefined;
  const legalName = item.legalName as string | undefined;
  const email = item.email as string | undefined;

  let label: string;
  if (displayId && (name || title)) {
    label = `${displayId} - ${name || title}`;
  } else if (legalName) {
    label = legalName;
  } else if (name) {
    label = name;
  } else if (title) {
    label = title;
  } else if (email) {
    label = email;
  } else {
    label = String(id ?? 'Unknown');
  }

  return { id, label };
}

/**
 * Determines whether further pages exist for a paginated picker query.
 *
 * When the authoritative total is known (from pagination metadata), there are
 * more pages only when the number of items fetched so far is below the total.
 * When no total is available, fall back to "the last page was full".
 */
export function hasMorePages(itemsFetched: number, limit: number, total?: number): boolean {
  if (typeof total === 'number') {
    return itemsFetched < total;
  }
  return itemsFetched >= limit;
}
