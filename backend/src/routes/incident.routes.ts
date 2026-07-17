import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { incidentService } from '../services/incident.service';

export const incidentRouter = Router();

incidentRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await incidentService.list(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

incidentRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const incident = await incidentService.getById(req.params.id);
    res.json(incident);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const incident = await incidentService.create(req.body, req.userId);
    res.status(201).json(incident);
  } catch (error) {
    next(error);
  }
});

incidentRouter.put('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const incident = await incidentService.update(req.params.id, req.body, req.userId);
    res.json(incident);
  } catch (error) {
    next(error);
  }
});

incidentRouter.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await incidentService.delete(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/:id/assess', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const assessment = await incidentService.assessIncident(req.params.id, req.body);
    res.status(201).json(assessment);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/:id/report', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const report = await incidentService.createReport(req.params.id, req.body);
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});