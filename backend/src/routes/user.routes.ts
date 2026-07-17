import { Router } from 'express';
import { authenticate } from '../middleware/auth';

export const userRouter = Router();

userRouter.get('/', authenticate, (_req, res, _next) => {
  res.json({ message: 'List users' });
});

userRouter.get('/:id', authenticate, (_req, res, _next) => {
  res.json({ message: 'Get user by ID' });
});

userRouter.put('/:id', authenticate, (_req, res, _next) => {
  res.json({ message: 'Update user' });
});

userRouter.delete('/:id', authenticate, (_req, res, _next) => {
  res.json({ message: 'Delete user' });
});
