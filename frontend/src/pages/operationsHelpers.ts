/**
 * Shared, non-component helpers for the Operations Workspace page.
 *
 * Extracted into their own module so that `OperationsWorkspace.tsx` only
 * exports components, which keeps React Fast Refresh working for the page.
 */

export const optionalNumber = (form: FormData, key: string): number | undefined => {
  const value = form.get(key);
  return value === null || value === '' ? undefined : Number(value);
};
