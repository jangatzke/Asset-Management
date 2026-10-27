import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { UserService } from '../services/user.service';
import { validateQuery } from '../middleware/validation';
import { UserSearchQuerySchema } from 'shared';

export const userRouter = Router();
const userService = new UserService();

// List users with pagination and search
userRouter.get('/', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    res.json(await userService.listUsers(_req.query));
  } catch (error) {
    next(error);
  }
});

// Search users (for owner dropdown) — query validated via shared Zod schema (ISSUE-1)
userRouter.get('/search', authenticate, requireAdminAccess, validateQuery(UserSearchQuerySchema), async (req, res, next) => {
  try {
    const { q, limit } = req.query as any;
    res.json(await userService.searchUsers(q ?? '', limit));
  } catch (error) {
    next(error);
  }
});

// Get users for owner selection dropdown — query validated via shared Zod schema (ISSUE-1)
userRouter.get('/owners', authenticate, requireAdminAccess, validateQuery(UserSearchQuerySchema.partial()), async (req, res, next) => {
  try {
    const { q } = req.query as { q?: string };
    res.json(await userService.getOwnersForSelect(q));
  } catch (error) {
    next(error);
  }
});

// Get user by ID
userRouter.get('/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    res.json(await userService.getUserById(req.params.id));
  } catch (error) {
    next(error);
  }
});

// Update user
userRouter.put('/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    res.json(await userService.updateUser(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
});

// Delete user
userRouter.delete('/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    await userService.deleteUser(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});
