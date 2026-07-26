import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeEntityRead, authorizeEntityWrite } from '../middleware/entityAuth';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { costPlanningService } from '../services/costPlanning.service';

export const costPlanningRouter = Router();

const IdParamSchema = z.object({ id: z.string().uuid() });
const ItemParamSchema = z.object({ itemId: z.string().uuid() });
const PlanQuerySchema = z.object({ fiscalYearLabel: z.string().optional(), status: z.string().optional() });
const CandidateQuerySchema = z.object({ fiscalYearLabel: z.string(), category: z.string().optional(), sourceType: z.string().optional(), search: z.string().optional() });
const CreatePlanSchema = z.object({ fiscalYearLabel: z.string(), ownerUserId: z.string().uuid().optional() });
const TakeoverSchema = z.object({ candidateKeys: z.array(z.string()).min(1) });
const ManualItemSchema = z.object({ title: z.string().min(1), description: z.string().optional(), category: z.string(), investmentType: z.string(), plannedAmount: z.union([z.string(), z.number()]), knownAmount: z.union([z.string(), z.number()]).optional(), currency: z.string().default('EUR'), plannedDate: z.string().datetime().optional(), dueDate: z.string().datetime().optional(), supplierName: z.string().optional() });
const UpdateItemSchema = ManualItemSchema.partial().extend({ status: z.string().optional() });
const MarkAcquiredSchema = z.object({ supplierName: z.string().optional(), invoiceNumber: z.string().min(1), invoiceDate: z.string().datetime(), acquiredAt: z.string().datetime().optional() });
const MarkDoneSchema = z.object({ completedAt: z.string().datetime().optional() });

costPlanningRouter.get('/years', authenticate, authorizeEntityRead('costPlanning'), async (_req, res, next) => {
  try { res.json(await costPlanningService.years()); } catch (error) { next(error); }
});

costPlanningRouter.get('/plans', authenticate, authorizeEntityRead('costPlanning'), validateQuery(PlanQuerySchema), async (req, res, next) => {
  try { res.json(await costPlanningService.listPlans(req.query as any)); } catch (error) { next(error); }
});

costPlanningRouter.post('/plans', authenticate, authorizeEntityWrite('costPlanning'), validateBody(CreatePlanSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await costPlanningService.createOrGetPlan(req.body.fiscalYearLabel, req.userId!, req.body.ownerUserId)); } catch (error) { next(error); }
});

costPlanningRouter.get('/plans/:id', authenticate, authorizeEntityRead('costPlanning'), validateParams(IdParamSchema), async (req, res, next) => {
  try { res.json(await costPlanningService.getPlan(req.params.id, req.query)); } catch (error) { next(error); }
});

costPlanningRouter.patch('/plans/:id', authenticate, authorizeEntityWrite('costPlanning'), validateParams(IdParamSchema), async (req: AuthRequest, res, next) => {
  try { res.json(await costPlanningService.updatePlan(req.params.id, req.body, req.userId!)); } catch (error) { next(error); }
});

costPlanningRouter.get('/candidates', authenticate, authorizeEntityRead('costPlanning'), validateQuery(CandidateQuerySchema), async (req, res, next) => {
  try { res.json(await costPlanningService.candidates((req.query as any).fiscalYearLabel, req.query as any)); } catch (error) { next(error); }
});

costPlanningRouter.post('/plans/:id/items/from-candidates', authenticate, authorizeEntityWrite('costPlanning'), validateParams(IdParamSchema), validateBody(TakeoverSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await costPlanningService.takeOverCandidates(req.params.id, req.body.candidateKeys, req.userId!)); } catch (error) { next(error); }
});

costPlanningRouter.post('/plans/:id/items', authenticate, authorizeEntityWrite('costPlanning'), validateParams(IdParamSchema), validateBody(ManualItemSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await costPlanningService.createManualItem(req.params.id, req.body, req.userId!)); } catch (error) { next(error); }
});

costPlanningRouter.patch('/items/:itemId', authenticate, authorizeEntityWrite('costPlanning'), validateParams(ItemParamSchema), validateBody(UpdateItemSchema), async (req: AuthRequest, res, next) => {
  try { res.json(await costPlanningService.updateItem(req.params.itemId, req.body, req.userId!)); } catch (error) { next(error); }
});

costPlanningRouter.post('/items/:itemId/mark-acquired', authenticate, authorizeEntityWrite('costPlanning'), validateParams(ItemParamSchema), validateBody(MarkAcquiredSchema), async (req: AuthRequest, res, next) => {
  try { res.json(await costPlanningService.markAcquired(req.params.itemId, req.body, req.userId!)); } catch (error) { next(error); }
});

costPlanningRouter.post('/items/:itemId/mark-done', authenticate, authorizeEntityWrite('costPlanning'), validateParams(ItemParamSchema), validateBody(MarkDoneSchema), async (req: AuthRequest, res, next) => {
  try { res.json(await costPlanningService.markDone(req.params.itemId, req.userId!, req.body.completedAt)); } catch (error) { next(error); }
});

costPlanningRouter.get('/plans/:id/export.csv', authenticate, authorizeEntityRead('costPlanning'), validateParams(IdParamSchema), async (req: AuthRequest, res, next) => {
  try { res.type('text/csv; charset=utf-8').send(await costPlanningService.exportCsv(req.params.id, req.query, req.userId!)); } catch (error) { next(error); }
});

costPlanningRouter.get('/reports/dashboard', authenticate, authorizeEntityRead('costPlanning'), async (_req, res, next) => {
  try { res.json(await costPlanningService.dashboardReport()); } catch (error) { next(error); }
});
