import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { UserService } from '../services/user.service';

export const userRouter = Router();
const userService = new UserService();

// List users with pagination and search
userRouter.get('/', authenticate, async (_req, res, next) => {
  try {
    res.json(await userService.listUsers(_req.query));
  } catch (error) {
    next(error);
  }
});

// Search users (for owner dropdown)
userRouter.get('/search', authenticate, async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const limit = parseInt(req.query.limit as string) || 20;
    res.json(await userService.searchUsers(q, limit));
  } catch (error) {
    next(error);
  }
});

// Get users for owner selection dropdown
userRouter.get('/owners', authenticate, async (req, res, next) => {
  try {
    const q = (req.query.q as string) || undefined;
    res.json(await userService.getOwnersForSelect(q));
  } catch (error) {
    next(error);
  }
});

// Get user by ID
userRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    res.json(await userService.getUserById(req.params.id));
  } catch (error) {
    next(error);
  }
});

// Update user
userRouter.put('/:id', authenticate, async (req, res, next) => {
  try {
    res.json(await userService.updateUser(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
});

// Delete user
userRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    res.json({ message: 'User deleted' });
    await userService.deleteUser(req.params.id);
  } catch (error) {
    next(error);
  }
});
