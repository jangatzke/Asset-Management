import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeEntityWrite, authorizeEntityDelete } from '../middleware/entityAuth';
import { validateBody } from '../middleware/validation';
import { incidentService } from '../services/incident.service';
import { z } from 'zod';

export const incidentRouter = Router();

const CreateIncidentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  detectionTime: z.coerce.date(),
  knowledgeTime: z.coerce.date(),
  reporterId: z.string().optional(),
  reporterSource: z.string().optional(),
  affectedAssetIds: z.array(z.string().uuid()).default([]),
  affectedServiceIds: z.array(z.string().uuid()).default([]),
  affectedProcessIds: z.array(z.string().uuid()).default([]),
  confidentialityImpact: z.enum(['none', 'low', 'medium', 'high']).default('none'),
  integrityImpact: z.enum(['none', 'low', 'medium', 'high']).default('none'),
  availabilityImpact: z.enum(['none', 'low', 'medium', 'high']).default('none'),
  operationalImpact: z.string().optional(),
  financialImpact: z.number().optional(),
  legalImpact: z.string().optional(),
  personalDataImpact: z.boolean().default(false),
  affectedCustomers: z.array(z.string()).default([]),
  affectedThirdParties: z.array(z.string()).default([]),
  suspectedCause: z.string().optional(),
  isIntentional: z.boolean().optional(),
  hasCrossBorderImpact: z.boolean().optional(),
  indicatorsOfCompromise: z.array(z.string()).default([]),
  immediateActions: z.array(z.string()).default([]),
  incidentManagerId: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});
const UpdateIncidentSchema = CreateIncidentSchema.partial().extend({ status: z.string().optional(), notificationStatus: z.string().optional() });
const AssessIncidentSchema = z.object({ assessorId: z.string().min(1), isReportable: z.boolean(), reportingJustification: z.string().optional(), decisionNotToReport: z.string().optional(), decisionApprovedBy: z.string().optional() });
const ChangeKnowledgeTimeSchema = z.object({ knowledgeTime: z.coerce.date(), reason: z.string().min(1) });
const CreateIncidentReportSchema = z.object({ reportType: z.enum(['early_warning_24h', 'incident_notification_72h', 'interim_report', 'monthly_final_report']), title: z.string().optional(), content: z.record(z.any()), authorId: z.string().min(1), recipient: z.string().optional(), submissionMethod: z.string().optional(), submissionProof: z.string().optional() });
const CreateIncidentCommunicationSchema = z.object({ channel: z.string().min(1), direction: z.enum(['inbound', 'outbound']), recipient: z.string().min(1), sender: z.string().optional(), message: z.string().min(1), scheduledAt: z.coerce.date().optional(), sentAt: z.coerce.date().optional() });
const CloseIncidentSchema = z.object({ rootCause: z.string().min(1).optional(), lessonsLearned: z.string().optional(), measuresEvaluation: z.string().min(1).optional(), closureSummary: z.string().optional() });
const CreateSignificanceRuleVersionSchema = z.object({ version: z.string().min(1), rules: z.array(z.record(z.any())).min(1), effectiveFrom: z.coerce.date().optional() });

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

incidentRouter.post('/:id/assess', authenticate, authorizeEntityWrite('incidents'), validateBody(AssessIncidentSchema), async (req: AuthRequest, res, next) => {
  try {
    const assessment = await incidentService.assessIncident(req.params.id, req.body);
    res.status(201).json(assessment);
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

incidentRouter.post('/:id/reports', authenticate, authorizeEntityWrite('incidents'), validateBody(CreateIncidentReportSchema), async (req: AuthRequest, res, next) => {
  try {
    const report = await incidentService.createIncidentReport(req.params.id, req.body);
    res.status(201).json(report);
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

incidentRouter.post('/:id/communications', authenticate, authorizeEntityWrite('incidents'), validateBody(CreateIncidentCommunicationSchema), async (req: AuthRequest, res, next) => {
  try {
    const communication = await incidentService.createCommunication(req.params.id, req.body, req.userId);
    res.status(201).json(communication);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/:id/close', authenticate, authorizeEntityWrite('incidents'), validateBody(CloseIncidentSchema), async (req: AuthRequest, res, next) => {
  try {
    const incident = await incidentService.closeIncident(req.params.id, req.body, req.userId ?? 'system');
    res.json(incident);
  } catch (error) {
    next(error);
  }
});

incidentRouter.post('/:id/report', authenticate, authorizeEntityWrite('incidents'), async (req: AuthRequest, res, next) => {
  try {
    const report = await incidentService.createReport(req.params.id, req.body);
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});
