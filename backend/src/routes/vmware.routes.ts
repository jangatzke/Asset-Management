/**
 * VMware Admin Routes
 *
 * API endpoints for managing VMware credentials and vCenter server configurations.
 * All routes require authentication.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { vmwareCredentialService } from '../services/vmware.credential';
import { vcenterService } from '../services/vcenter.service';

export const vmwareRouter = Router();

// ==========================================
// VMware Credential Routes
// ==========================================

/** GET /admin/vmware/credentials - List all VMware credentials */
vmwareRouter.get('/credentials', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const credentials = await vmwareCredentialService.listCredentials();
    res.json(credentials);
  } catch (error) {
    next(error);
  }
});

/** POST /admin/vmware/credentials - Create a new VMware credential */
vmwareRouter.post('/credentials', authenticate, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, username, password } = req.body;
    if (!name || !username || !password) {
      res.status(400).json({ success: false, error: 'name, username, and password are required' });
      return;
    }
    const credential = await vmwareCredentialService.createCredential({ name, username, password });
    res.status(201).json(credential);
  } catch (error) {
    next(error);
  }
});

/** PUT /admin/vmware/credentials/:id - Update a VMware credential */
vmwareRouter.put('/credentials/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, username, password, isDefault } = req.body;
    const credential = await vmwareCredentialService.updateCredential(req.params.id, {
      name,
      username,
      password,
      isDefault,
    });
    res.json(credential);
  } catch (error) {
    next(error);
  }
});

/** DELETE /admin/vmware/credentials/:id - Delete a VMware credential */
vmwareRouter.delete('/credentials/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await vmwareCredentialService.deleteCredential(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// vCenter Server Routes
// ==========================================

/** GET /admin/vmware/vcenters - List all vCenter servers */
vmwareRouter.get('/vcenters', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const servers = await vcenterService.listServers();
    res.json(servers);
  } catch (error) {
    next(error);
  }
});

/** POST /admin/vmware/vcenters - Create a new vCenter server config */
vmwareRouter.post('/vcenters', authenticate, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, host, port, credentialId } = req.body;
    if (!name || !host || !credentialId) {
      res.status(400).json({ success: false, error: 'name, host, and credentialId are required' });
      return;
    }
    const server = await vcenterService.createServer({ name, host, port, credentialId });
    res.status(201).json(server);
  } catch (error) {
    next(error);
  }
});

/** PUT /admin/vmware/vcenters/:id - Update a vCenter server config */
vmwareRouter.put('/vcenters/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, host, port, credentialId, enabled } = req.body;
    const server = await vcenterService.updateServer(req.params.id, {
      name,
      host,
      port,
      credentialId,
      enabled,
    });
    res.json(server);
  } catch (error) {
    next(error);
  }
});

/** DELETE /admin/vmware/vcenters/:id - Delete a vCenter server config */
vmwareRouter.delete('/vcenters/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await vcenterService.deleteServer(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/** POST /admin/vmware/vcenters/:id/import - Import VMs from vCenter */
vmwareRouter.post('/vcenters/:id/import', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dryRun = req.body.dryRun === true;
    const result = await vcenterService.importVMs(req.params.id, { dryRun });
    res.json({ ...result, dryRun });
  } catch (error) {
    next(error);
  }
});

/** POST /admin/vmware/vcenters/:id/test-connection - Test vCenter connection */
vmwareRouter.post('/vcenters/:id/test-connection', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await vcenterService.testConnection(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
