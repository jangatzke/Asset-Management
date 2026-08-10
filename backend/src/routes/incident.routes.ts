import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeEntityWrite, authorizeEntityDelete, requireEntityPermission, requirePermission } from '../middleware/entityAuth';
import { validateBody } from '../middleware/validation';
import { incidentService } from '../services/incident.service';
import { authorizationService } from '../services/authorization.service';
import { AssessIncidentSchema, ChangeKnowledgeTimeSchema, CloseIncidentSchema, CreateIncidentCommunicationSchema, CreateIncidentReportSchema, CreateIncidentSchema, CreateSignificanceRuleVersionSchema, DecideIncidentNonReportableApprovalSchema, UpdateIncidentSchema } from 'shared';

export const incidentRouter = Router();

incidentRouter.get('/', authenticate, requirePermission('incidents.read'), async (req: AuthRequest, res, next) => {
  try {
    const result = await incidentService.list(req.query, await authorizationService.buildReadFilter(req.userId!, 'incidents') as any);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/', authenticate, authorizeEntityWrite('incidents'), validateBody(CreateIncidentSchema), async (req: AuthRequest, res, next) => {
  try {
    const incident = await incidentService.create(req.body, req.userId);
    res.status(201).json(incident);
  } catch (error) {
    next(error);
  }
});

incidentRouter.put('/:id', authenticate, authorizeEntityWrite('incidents'), validateBody(UpdateIncidentSchema), async (req: AuthRequest, res, next) => {
  try {
    const incident = await incidentService.update(req.params.id, req.body, req.userId);
    res.json(incident);
  } catch (error) {
    next(error);
  }
});

incidentRouter.delete('/:id', authenticate, authorizeEntityDelete('incidents'), async (req: AuthRequest, res, next) => {
  try {
    const result = await incidentService.delete(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/significance-rules', authenticate, authorizeEntityWrite('incidents'), validateBody(CreateSignificanceRuleVersionSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await incidentService.createSignificanceRuleVersion(req.body, req.userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/escalations/run-overdue', authenticate, authorizeEntityWrite('incidents'), async (_req: AuthRequest, res, next) => {
  try {
    const result = await incidentService.escalateOverdueDeadlines();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

incidentRouter.get('/reports/:reportId/export', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const report = await incidentService.exportReportPackage(req.params.reportId, req.userId ?? 'system');
    res.json(report);
  } catch (error) {
    next(error);
  }
});

incidentRouter.get('/:id', authenticate, requireEntityPermission('incidents.read', 'incidents'), async (req, res, next) => {
  try {
    const incident = await incidentService.getById(req.params.id);
    res.json(incident);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/:id/assess', authenticate, requireEntityPermission('incidents.assess', 'incidents'), validateBody(AssessIncidentSchema), async (req: AuthRequest, res, next) => {
  try {
    const assessment = await incidentService.assessIncident(req.params.id, req.body, req.userId!);
    res.status(201).json(assessment);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/:id/non-reportable-approval', authenticate, requirePermission('nis2.approve'), requireEntityPermission('incidents.read', 'incidents'), validateBody(DecideIncidentNonReportableApprovalSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await incidentService.decideNonReportableAssessment(req.params.id, req.body, req.userId!));
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/:id/knowledge-time', authenticate, authorizeEntityWrite('incidents'), validateBody(ChangeKnowledgeTimeSchema), async (req: AuthRequest, res, next) => {
  try {
    const incident = await incidentService.changeKnowledgeTime(req.params.id, req.body.knowledgeTime, req.body.reason, req.userId ?? 'system');
    res.json(incident);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/:id/recalculate-deadlines', authenticate, authorizeEntityWrite('incidents'), async (req: AuthRequest, res, next) => {
  try {
    const deadlines = await incidentService.recalculateDeadlines(req.params.id);
    res.json(deadlines);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/:id/reports', authenticate, requireEntityPermission('incidents.report', 'incidents'), validateBody(CreateIncidentReportSchema), async (req: AuthRequest, res, next) => {
  try {
    const report = await incidentService.createIncidentReport(req.params.id, req.body, req.userId!);
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/:id/communications', authenticate, authorizeEntityWrite('incidents'), validateBody(CreateIncidentCommunicationSchema), async (req: AuthRequest, res, next) => {
  try {
    const communication = await incidentService.createCommunication(req.params.id, req.body, req.userId);
    res.status(201).json(communication);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/:id/close', authenticate, requireEntityPermission('incidents.close', 'incidents'), validateBody(CloseIncidentSchema), async (req: AuthRequest, res, next) => {
  try {
    const incident = await incidentService.closeIncident(req.params.id, req.body, req.userId ?? 'system');
    res.json(incident);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/:id/report', authenticate, requireEntityPermission('incidents.report', 'incidents'), validateBody(CreateIncidentReportSchema), async (req: AuthRequest, res, next) => {
  try {
    const report = await incidentService.createReport(req.params.id, req.body, req.userId!);
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Incident History (AUDIT-001)
// ==========================================

incidentRouter.get('/:id/history', authenticate, requireEntityPermission('incidents.read', 'incidents'), async (req: AuthRequest, res, next) => {
  try {
    const incidentId = req.params.id;
    // Verify incident exists and user has read access
    await incidentService.getById(incidentId);
    const query = {
      action: req.query.action as any,
      limit: parseInt(req.query.limit as string) || 100,
      offset: parseInt(req.query.offset as string) || 0,
    };
    const history = await incidentService.getHistory(incidentId, query);
    res.json(history);
  } catch (error) {
    next(error);
  }
});
