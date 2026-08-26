import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/entityAuth';
import { validateBody } from '../middleware/validation';
import { CatalogService } from '../services/catalog.service';
import { z } from 'zod';

export const catalogRouter = Router();
const catalogService = new CatalogService();

const CreateCatalogSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  url: z.string().optional(),
});

const CreateCatalogItemSchema = z.object({
  catalogId: z.string().uuid(),
  controlId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  controlText: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  sortOrder: z.number().optional(),
  tags: z.string().array().optional(),
});

// List all catalogs
catalogRouter.get('/catalogs', authenticate, requirePermission('controls.read'), async (req, res, next) => {
  try {
    res.json(await catalogService.listCatalogs(req.query));
  } catch (error) {
    next(error);
  }
});

// Get catalog by ID
catalogRouter.get('/catalogs/:id', authenticate, requirePermission('controls.read'), async (req, res, next) => {
  try {
    res.json(await catalogService.getCatalog(req.params.id));
  } catch (error) {
    next(error);
  }
});

// Create catalog
catalogRouter.post('/catalogs', authenticate, requirePermission('controls.write'), validateBody(CreateCatalogSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await catalogService.createCatalog(req.body));
  } catch (error) {
    next(error);
  }
});

// Update catalog
catalogRouter.patch('/catalogs/:id', authenticate, requirePermission('controls.write'), validateBody(CreateCatalogSchema.partial()), async (req: AuthRequest, res, next) => {
  try {
    res.json(await catalogService.updateCatalog(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
});

// Delete catalog
catalogRouter.delete('/catalogs/:id', authenticate, requirePermission('controls.write'), async (req, res, next) => {
  try {
    res.json({ message: 'Catalog deleted' });
    await catalogService.deleteCatalog(req.params.id);
  } catch (error) {
    next(error);
  }
});

// List catalog items
catalogRouter.get('/catalogs/items', authenticate, requirePermission('controls.read'), async (req, res, next) => {
  try {
    res.json(await catalogService.listCatalogItems(req.query));
  } catch (error) {
    next(error);
  }
});

// Get catalog item by catalogId + controlId
catalogRouter.get('/catalogs/items/:catalogId/:controlId', authenticate, requirePermission('controls.read'), async (req, res, next) => {
  try {
    res.json(await catalogService.getCatalogItem(req.params.catalogId, req.params.controlId));
  } catch (error) {
    next(error);
  }
});

// Create catalog item
catalogRouter.post('/catalogs/items', authenticate, requirePermission('controls.write'), validateBody(CreateCatalogItemSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await catalogService.createCatalogItem(req.body));
  } catch (error) {
    next(error);
  }
});

// Update catalog item
catalogRouter.patch('/catalogs/items/:catalogId/:controlId', authenticate, requirePermission('controls.write'), validateBody(CreateCatalogItemSchema.partial()), async (req: AuthRequest, res, next) => {
  try {
    res.json(await catalogService.updateCatalogItem(req.params.catalogId, req.params.controlId, req.body));
  } catch (error) {
    next(error);
  }
});

// Delete catalog item
catalogRouter.delete('/catalogs/items/:catalogId/:controlId', authenticate, requirePermission('controls.write'), async (req, res, next) => {
  try {
    res.json({ message: 'Catalog item deleted' });
    await catalogService.deleteCatalogItem(req.params.catalogId, req.params.controlId);
  } catch (error) {
    next(error);
  }
});

// Get catalog options for dropdown selection
catalogRouter.get('/catalogs/options', authenticate, async (_req, res, next) => {
  try {
    res.json(await catalogService.getCatalogOptions());
  } catch (error) {
    next(error);
  }
});

// Get catalogs for a specific control
catalogRouter.get('/controls/:controlId/catalogs', authenticate, async (req, res, next) => {
  try {
    res.json(await catalogService.getCatalogsForControl(req.params.controlId));
  } catch (error) {
    next(error);
  }
});

// Ensure the NIS2 obligation catalogue (controlled write action).
catalogRouter.post('/catalogs/nis2-articles/ensure', authenticate, requirePermission('controls.write'), async (_req, res, next) => {
  try {
    const catalog = await catalogService.ensureNis2UmsuCGCatalog();
    res.json(catalog);
  } catch (error) {
    next(error);
  }
});

// Get the NIS2 obligation catalogue (creates it if missing).
catalogRouter.get('/catalogs/nis2-articles', authenticate, async (_req, res, next) => {
  try {
    const catalog = await catalogService.getNis2ObligationCatalog();
    res.json(catalog);
  } catch (error) {
    next(error);
  }
});
