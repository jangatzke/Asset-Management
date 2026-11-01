/**
 * Permission helpers for UI-only gating of actions whose backend counterpart
 * enforces a stricter guard.
 *
 * Source of truth for asset restore: `POST /assets/:id/restore` is guarded by
 * `requireAdminAccess` in [`asset.routes.ts`](../../backend/src/routes/asset.routes.ts:188),
 * which resolves to the granular permission `administration.access`
 * (see [`authorization.service.ts`](../../backend/src/services/authorization.service.ts:201))
 * and is additionally granted by the `system_admin` role.
 *
 * `canRestoreAssets` deliberately reuses the existing auth-store data
 * (`user.permissions` / `user.roles`) instead of inventing a new auth model:
 *  - When a permission list is present (current `/auth/me` and login payloads),
 *    the granular permission decides.
 *  - Older sessions issued before permissions were returned have no list, so we
 *    fall back to the existing role check used by [`Assets.tsx`](../pages/Assets.tsx:155).
 *
 * This mirrors how the rest of the UI already gates navigation
 * ([`Layout.tsx`](../components/Layout.tsx:227) and [`KnowledgeBase.tsx`](../pages/KnowledgeBase.tsx:18)).
 */

export interface AuthUserLike {
  roles?: string[] | null;
  permissions?: string[] | null;
}

/** Granular permission required by the backend `requireAdminAccess` guard. */
export const ADMIN_ACCESS_PERMISSION = 'administration.access';

/**
 * True when the current user may perform a restore (un-archive).
 * Never assume access when no user/permission data is available.
 */
export function canRestoreAssets(user: AuthUserLike | null | undefined): boolean {
  if (!user) return false;
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.includes(ADMIN_ACCESS_PERMISSION);
  }
  return Boolean(user.roles?.includes('system_admin'));
}
