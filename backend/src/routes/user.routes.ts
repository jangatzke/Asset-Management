import { Router } from 'express';
import { authenticate } from '../middleware/auth';

export const userRouter = Router();

userRouter.get('/', authenticate, (_req, res, _next) => {
  // TODO: Implement user listing with pagination and filtering
  res.status(501).json({ error: 'Not Implemented', message: 'User listing endpoint is not yet implemented' });
});

userRouter.get('/:id', authenticate, (_req, res, _next) => {
  // TODO: Implement get user by ID
  res.status(501).json({ error: 'Not Implemented', message: 'Get user by ID endpoint is not yet implemented' });
});

userRouter.put('/:id', authenticate, (_req, res, _next) => {
  // TODO: Implement update user
  res.status(501).json({ error: 'Not Implemented', message: 'Update user endpoint is not yet implemented' });
});

userRouter.delete('/:id', authenticate, (_req, res, _next) => {
  // TODO: Implement delete user
  res.status(501).json({ error: 'Not Implemented', message: 'Delete user endpoint is not yet implemented' });
});
