/**
 * Intune Admin Routes
 *
 * API endpoints for controlling Intune sync operations and managing
 * registered app credentials (separate from OIDC Entra app).
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { initializeSyncService, getSyncService } from '../services/intune.service';
import { initializeScheduler, getScheduler } from '../services/intune.scheduler';
import { adminService } from '../services/admin.service';

export const intuneRouter = Router();

// Helper to get sync service
function getSyncServiceInstance() {
  let service = getSyncService();
  if (!service) {
    service = initializeSyncService();
  }
  return service;
}

// ---- Sync Status ----

intuneRouter.get('/status', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const service = getSyncServiceInstance();
    const status = await service.getStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

// ---- Configuration ----

intuneRouter.get('/config', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const service = getSyncServiceInstance();
    const config = await service.getConfig();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

intuneRouter.put('/config', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const service = getSyncServiceInstance();
    const config = await service.updateConfig(req.body);
    res.json(config);
  } catch (error) {
    next(error);
  }
});

// ---- Sync Triggers ----

intuneRouter.post('/sync/full', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const service = getSyncServiceInstance();
    const result = await service.runFullSync();
    res.json({ message: 'Full sync triggered', status: result });
  } catch (error) {
    next(error);
  }
});

intuneRouter.post('/sync/incremental', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const service = getSyncServiceInstance();
    const result = await service.runIncrementalSync();
    res.json({ message: 'Incremental sync triggered', status: result });
  } catch (error) {
    next(error);
  }
});

// ---- Devices ----

intuneRouter.get('/devices', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    const service = getSyncServiceInstance();
    const result = await service.getSyncedDevices(page, limit, search);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

intuneRouter.get('/devices/:id', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    getSyncServiceInstance();
    // Find specific device
    res.json({ id: _req.params.id });
  } catch (error) {
    next(error);
  }
});

intuneRouter.post('/devices/:id/resync', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const service = getSyncServiceInstance();
    await service.resyncDevice(req.params.id);
    res.json({ message: `Device ${req.params.id} resynced successfully` });
  } catch (error) {
    next(error);
  }
});

intuneRouter.delete('/devices/:id/archive', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const service = getSyncServiceInstance();
    await service.archiveDevice(req.params.id);
    res.json({ message: `Device ${req.params.id} archived successfully` });
  } catch (error) {
    next(error);
  }
});

// ---- Health Check ----

intuneRouter.get('/health', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const service = getSyncServiceInstance();
    const health = await service.checkHealth();
    res.json({
      intune: health,
      auth: (req as any).authService?.getStatus?.() || null,
    });
  } catch (error) {
    next(error);
  }
});

// ---- Scheduler Control ----

intuneRouter.post('/scheduler/start', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const scheduler = initializeScheduler();
    await scheduler.start();
    res.json({ message: 'Scheduler started' });
  } catch (error) {
    next(error);
  }
});

intuneRouter.post('/scheduler/stop', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const scheduler = getScheduler();
    if (scheduler) {
      scheduler.stop();
    }
    res.json({ message: 'Scheduler stopped' });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Intune App Credentials Management
// Separate Entra app credentials for Intune (different from OIDC)
// ==========================================

// GET /credentials - Get current Intune app credentials (without secrets)
intuneRouter.get('/credentials', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const credentials = await adminService.getIntuneCredentials();
    res.json(credentials);
  } catch (error) {
    next(error);
  }
});

// POST /credentials - Create new Intune app credentials
intuneRouter.post('/credentials', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const credentials = await adminService.createIntuneCredentials(req.body);
    res.status(201).json(credentials);
  } catch (error) {
    next(error);
  }
});

// PUT /credentials - Update existing Intune app credentials
intuneRouter.put('/credentials', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const credentials = await adminService.updateIntuneCredentials(req.body);
    res.json(credentials);
  } catch (error) {
    next(error);
  }
});

// DELETE /credentials - Delete Intune app credentials
intuneRouter.delete('/credentials', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.deleteIntuneCredentials();
    res.json(result);
  } catch (error) {
    next(error);
  }
});
