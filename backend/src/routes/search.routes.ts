import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { searchService, type GlobalSearchQuery } from '../services/search.service';
import { SEARCH_ENTITY_TYPES, type SearchEntityType } from 'shared';

export const searchRouter = Router();

/**
 * GET /api/v1/search?q=…&limit=…&type=…&offset=…
 *
 * Global full-text search across all entity types the caller is allowed to read.
 * Results are grouped by entity type; `type` restricts the response to a single
 * category (used for "show all results of this category"), `offset` pages inside
 * one category. Every category's result set is filtered through the same read
 * authorization the dedicated list endpoints enforce.
 */
searchRouter.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (!q.trim()) throw new AppError('Query parameter "q" is required', 400);
    if (q.length > 200) throw new AppError('Query too long (max 200 characters)', 400);

    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    if (limitRaw !== undefined && (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 50)) {
      throw new AppError('limit must be an integer between 1 and 50', 400);
    }

    const typeRaw = typeof req.query.type === 'string' ? req.query.type : undefined;
    if (typeRaw && !(SEARCH_ENTITY_TYPES as readonly string[]).includes(typeRaw)) {
      throw new AppError('Unknown search type', 400);
    }

    const offsetRaw = typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined;
    if (offsetRaw !== undefined && (!Number.isInteger(offsetRaw) || offsetRaw < 0)) {
      throw new AppError('offset must be a non-negative integer', 400);
    }

    const query: GlobalSearchQuery = {
      q,
      limit: limitRaw,
      type: typeRaw as SearchEntityType | undefined,
      offset: offsetRaw,
    };
    res.json(await searchService.search(req.userId!, query));
  } catch (error) {
    next(error);
  }
});
