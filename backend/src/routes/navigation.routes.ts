import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { navigationConfigService } from '../services/navigationConfig.service';
import { navigationViewService } from '../services/navigationView.service';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const navigationRouter = Router();

// Read the GLOBAL default navigation order and hidden entries. Every
// authenticated user needs this to render the header; editing is restricted
// to /admin/navigation/config.
navigationRouter.get('/config', authenticate, async (_req, res, next) => {
  try {
    const config = await navigationConfigService.getConfig();
    res.json({ navOrder: config.navOrder, hiddenEntries: config.hiddenEntries });
  } catch (error) {
    next(error);
  }
});

// ---- Navigation views (personal + visible global views) ----

// All views available to the current user: global views plus their own.
navigationRouter.get('/views', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json(await navigationViewService.listViewsForUser(req.userId!));
  } catch (error) {
    next(error);
  }
});

// Create a personal view for the current user.
navigationRouter.post('/views', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await navigationViewService.createView(req.body ?? {}, req.userId!));
  } catch (error) {
    next(error);
  }
});

// The view the current user should see right now (active selection or default).
navigationRouter.get('/views/active', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const view = await navigationViewService.resolveActiveView(req.userId!);
    res.json({ view });
  } catch (error) {
    next(error);
  }
});

// Quick switch: set the view currently active for the current user.
// Pass { viewId: null } to fall back to the default resolution chain.
// NOTE: registered before /views/:id so "active" is not treated as an id.
navigationRouter.put('/views/active', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const rawViewId = req.body?.viewId;
    if (rawViewId !== null && typeof rawViewId !== 'string') {
      throw new AppError('viewId must be a string or null', 400);
    }
    if (rawViewId !== null) {
      const view = await navigationViewService.getView(rawViewId);
      if (!view || (view.ownerId !== null && view.ownerId !== req.userId)) {
        throw new AppError('Navigation view not found', 404);
      }
    }
    await prisma.user.update({
      where: { id: req.userId! },
      data: { activeNavigationViewId: rawViewId ?? null },
    });
    const view = await navigationViewService.resolveActiveView(req.userId!);
    res.json({ view });
  } catch (error) {
    next(error);
  }
});

// Update a personal view of the current user.
navigationRouter.put('/views/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const view = await navigationViewService.getView(req.params.id);
    if (!view || view.ownerId !== req.userId) throw new AppError('Navigation view not found', 404);
    res.json(await navigationViewService.updateView(req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

// Mark a personal view of the current user as their default.
navigationRouter.post('/views/:id/default', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const view = await navigationViewService.getView(req.params.id);
    if (!view || view.ownerId !== req.userId) throw new AppError('Navigation view not found', 404);
    res.json(await navigationViewService.setDefault(req.params.id));
  } catch (error) {
    next(error);
  }
});

// Delete a personal view of the current user.
navigationRouter.delete('/views/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const view = await navigationViewService.getView(req.params.id);
    if (!view || view.ownerId !== req.userId) throw new AppError('Navigation view not found', 404);
    await navigationViewService.deleteView(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
