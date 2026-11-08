import { AppError } from '../middleware/errorHandler';

/**
 * Centralised user-reference validation (F-01/F-14 referential integrity).
 *
 * Every domain service that stores a user id (ticket requester/assignee/manager,
 * asset owners, risk owners/assessors, document owners/reviewers/approvers,
 * SoA approvers, management-review chairs, phase-6 owners, ...) must resolve the
 * referenced user through this single code path so error semantics stay uniform:
 *
 *  - `null` / `undefined` references are allowed (clearing an optional assignment).
 *  - A supplied id that does not resolve to a user -> 400.
 *  - A supplied id that resolves to an inactive user -> 409.
 *
 * The helper is intentionally generic: it takes any object whose values are user
 * ids and validates only the fields that are present and non-null. Callers pass
 * a transaction/client delegate (`tx.user`) so validation runs inside the same
 * transaction as the write it guards.
 */
export type UserReferenceContainer = {
  user: {
    findMany: (args: any) => Promise<Array<{ id: string; isActive: boolean }>>;
  };
};

export type UserReferenceFields = Record<string, string | null | undefined>;

/**
 * Validate that the supplied user reference ids point to existing, active users.
 *
 * @param db   Prisma client or interactive transaction exposing `user.findMany`.
 * @param refs Field -> user id map. Only truthy ids are validated.
 * @returns    The same `refs` object (unchanged) for convenient chaining.
 */
export async function validateUserReferences<T extends UserReferenceFields>(
  db: UserReferenceContainer,
  refs: T,
): Promise<T> {
  const entries = Object.entries(refs).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0,
  );
  if (!entries.length) return refs;

  const ids = [...new Set(entries.map(([, id]) => id))];
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, isActive: true },
  });
  const activeById = new Map<string, boolean>(users.map((user) => [user.id, user.isActive]));

  for (const [field, id] of entries) {
    if (!activeById.has(id)) {
      throw new AppError(`${field} references a user that does not exist`, 400);
    }
    if (activeById.get(id) === false) {
      throw new AppError(`${field} references an inactive user`, 409);
    }
  }

  return refs;
}

/**
 * Validate a single user reference. Kept as a thin wrapper for services that
 * only guard one field (e.g. document acknowledgements, SoA approvals).
 */
export async function validateUserReference(
  db: UserReferenceContainer,
  field: string,
  id: string | null | undefined,
): Promise<string | null | undefined> {
  if (!id) return id;
  await validateUserReferences(db, { [field]: id });
  return id;
}

/**
 * Convenience alias used by services that validate a set of known user-id
 * fields and want the list of fields to stay declarative at the call site.
 */
export function pickUserReferences(
  source: Record<string, any>,
  fields: string[],
): UserReferenceFields {
  const refs: UserReferenceFields = {};
  for (const field of fields) refs[field] = source[field];
  return refs;
}
