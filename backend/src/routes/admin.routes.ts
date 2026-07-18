import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { adminService } from '../services/admin.service';

export const adminRouter = Router();

// ---- User Management ----

adminRouter.get('/users', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const users = await adminService.listUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/users/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const user = await adminService.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
    } else {
      res.json(user);
    }
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const user = await adminService.createUser(req.body, req.userId!);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/users/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const user = await adminService.updateUser(req.params.id, req.body, req.userId!);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/users/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.deleteUser(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users/:id/change-password', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    await adminService.changePassword(req.params.id, req.body.newPassword, req.userId!);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/users/:id/roles', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const user = await adminService.assignRoles(req.params.id, req.body);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// ---- Role Management ----

adminRouter.get('/roles', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const roles = await adminService.getAvailableRoles();
    res.json(roles);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/roles', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const role = await adminService.createRole(req.body);
    res.status(201).json(role);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/roles/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const role = await adminService.updateRole(req.params.id, req.body);
    res.json(role);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/roles/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.deleteRole(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ---- Group Management ----

adminRouter.get('/groups', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const groups = await adminService.listGroups();
    res.json(groups);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/groups', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const group = await adminService.createGroup(req.body);
    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/groups/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const group = await adminService.updateGroup(req.params.id, req.body);
    res.json(group);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/groups/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.deleteGroup(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/groups/:id/users', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    await adminService.assignUsersToGroup(req.params.id, req.body);
    res.json({ message: 'Users assigned to group successfully' });
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/groups/:id/roles', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    await adminService.assignRolesToGroup(req.params.id, req.body);
    res.json({ message: 'Roles assigned to group successfully' });
  } catch (error) {
    next(error);
  }
});

// ---- OIDC Configuration ----

adminRouter.get('/oidc/config', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const config = await adminService.getOidcConfig();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/oidc/config', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const config = await adminService.updateOidcConfig(req.body);
    res.json(config);
  } catch (error) {
    next(error);
  }
});

// ---- Asset Type Management ----

adminRouter.get('/asset-types', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const types = await adminService.listAssetTypes();
    res.json(types);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/asset-types', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const type = await adminService.createAssetType(req.body);
    res.status(201).json(type);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/asset-types/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const type = await adminService.updateAssetType(req.params.id, req.body);
    res.json(type);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/asset-types/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.deleteAssetType(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/asset-types/:id/archive', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const type = await adminService.archiveAssetType(req.params.id);
    res.json(type);
  } catch (error) {
    next(error);
  }
});

// ---- Business Process Management (RSK-010) ----

adminRouter.get('/business-processes', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const processes = await adminService.listBusinessProcesses();
    res.json(processes);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/business-processes/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const process = await adminService.getBusinessProcessById(req.params.id);
    res.json(process);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/business-processes', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const process = await adminService.createBusinessProcess(req.body);
    res.status(201).json(process);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/business-processes/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const process = await adminService.updateBusinessProcess(req.params.id, req.body);
    res.json(process);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/business-processes/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.deleteBusinessProcess(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
