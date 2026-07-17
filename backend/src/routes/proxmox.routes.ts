/**
 * Proxmox Admin Routes
 *
 * API endpoints for managing Proxmox credentials and server configurations.
 * All routes require authentication.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { proxmoxCredentialService } from '../services/proxmox.credential';
import { proxmoxService } from '../services/proxmox.service';

export const proxmoxRouter = Router();

// ==========================================
// Proxmox Credential Routes
// ==========================================

/** GET /admin/proxmox/credentials - List all Proxmox credentials */
proxmoxRouter.get('/credentials', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const credentials = await proxmoxCredentialService.listCredentials();
    res.json(credentials);
  } catch (error) {
    next(error);
  }
});

/** POST /admin/proxmox/credentials - Create a new Proxmox credential */
proxmoxRouter.post('/credentials', authenticate, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, username, password, apiToken } = req.body;
    if (!name || !username) {
      res.status(400).json({ success: false, error: 'name and username are required' });
      return;
    }
    if (!password && !apiToken) {
      res.status(400).json({ success: false, error: 'either password or apiToken is required' });
      return;
    }
    const credential = await proxmoxCredentialService.createCredential({ name, username, password, apiToken });
    res.status(201).json(credential);
  } catch (error) {
    next(error);
  }
});

/** PUT /admin/proxmox/credentials/:id - Update a Proxmox credential */
proxmoxRouter.put('/credentials/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, username, password, apiToken, isDefault } = req.body;
    const credential = await proxmoxCredentialService.updateCredential(req.params.id, {
      name,
      username,
      password,
      apiToken,
      isDefault,
    });
    res.json(credential);
  } catch (error) {
    next(error);
  }
});

/** DELETE /admin/proxmox/credentials/:id - Delete a Proxmox credential */
proxmoxRouter.delete('/credentials/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await proxmoxCredentialService.deleteCredential(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Proxmox Server Routes
// ==========================================

/** GET /admin/proxmox/servers - List all Proxmox servers */
proxmoxRouter.get('/servers', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const servers = await proxmoxService.listServers();
    res.json(servers);
  } catch (error) {
    next(error);
  }
});

/** POST /admin/proxmox/servers - Create a new Proxmox server config */
proxmoxRouter.post('/servers', authenticate, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, host, port, nodeId, credentialId } = req.body;
    if (!name || !host || !credentialId) {
      res.status(400).json({ success: false, error: 'name, host, and credentialId are required' });
      return;
    }
    const server = await proxmoxService.createServer({ name, host, port, nodeId, credentialId });
    res.status(201).json(server);
  } catch (error) {
    next(error);
  }
});

/** PUT /admin/proxmox/servers/:id - Update a Proxmox server config */
proxmoxRouter.put('/servers/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, host, port, nodeId, credentialId, enabled } = req.body;
    const server = await proxmoxService.updateServer(req.params.id, {
      name,
      host,
      port,
      nodeId,
      credentialId,
      enabled,
    });
    res.json(server);
  } catch (error) {
    next(error);
  }
});

/** DELETE /admin/proxmox/servers/:id - Delete a Proxmox server config */
proxmoxRouter.delete('/servers/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await proxmoxService.deleteServer(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/** POST /admin/proxmox/servers/:id/import - Import VMs/containers from Proxmox */
proxmoxRouter.post('/servers/:id/import', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dryRun = req.body.dryRun === true;
    const result = await proxmoxService.importVMs(req.params.id, { dryRun });
    res.json({ ...result, dryRun });
  } catch (error) {
    next(error);
  }
});

/** POST /admin/proxmox/servers/:id/test-connection - Test Proxmox connection */
proxmoxRouter.post('/servers/:id/test-connection', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await proxmoxService.testConnection(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
