import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeEntityRead, authorizeEntityWrite } from '../middleware/entityAuth';
import { validateBody } from '../middleware/validation';
import { nis2Service } from '../services/nis2.service';
import { z } from 'zod';

export const nis2Router = Router();

const CreateNis2QuestionnaireVersionSchema = z.object({ version: z.string().min(1), title: z.string().min(1), questions: z.array(z.record(z.any())).min(1), scoringRules: z.record(z.any()), effectiveFrom: z.coerce.date().optional() });
const CreateNis2AssessmentSchema = z.object({ organizationUnitId: z.string().uuid().optional(), questionnaireVersion: z.string().optional(), answers: z.record(z.any()), justification: z.string().optional() });
const ApproveNis2AssessmentSchema = z.object({ result: z.enum(['essential_entity', 'important_entity', 'not_in_scope']).optional(), justification: z.string().optional() });
const CreateNis2RegistrationSchema = z.object({ assessmentId: z.string().uuid().optional(), entityType: z.string().min(1), registrationDate: z.coerce.date().optional(), deadline: z.coerce.date(), contactPerson: z.string().optional(), contactDetails: z.string().optional(), submittedData: z.record(z.any()).optional(), submissionProof: z.string().optional(), bsiConfirmation: z.string().optional() });
const CreateNis2RegistrationChangeSchema = z.object({ changeType: z.string().min(1), description: z.string().min(1), changedData: z.record(z.any()), notificationDeadline: z.coerce.date().optional(), submittedAt: z.coerce.date().optional(), submissionProof: z.string().optional() });

nis2Router.get('/questionnaires/active', authenticate, authorizeEntityRead('controls'), async (_req: AuthRequest, res, next) => {
  try { res.json(await nis2Service.listActiveQuestionnaires()); } catch (error) { next(error); }
});

nis2Router.get('/assessments', authenticate, authorizeEntityRead('controls'), async (_req: AuthRequest, res, next) => {
  try { res.json(await nis2Service.listAssessments()); } catch (error) { next(error); }
});

nis2Router.get('/assessments/:id', authenticate, authorizeEntityRead('controls'), async (req: AuthRequest, res, next) => {
  try { res.json(await nis2Service.getAssessment(req.params.id)); } catch (error) { next(error); }
});

nis2Router.get('/registrations', authenticate, authorizeEntityRead('controls'), async (_req: AuthRequest, res, next) => {
  try { res.json(await nis2Service.listRegistrations()); } catch (error) { next(error); }
});

nis2Router.get('/registrations/:id', authenticate, authorizeEntityRead('controls'), async (req: AuthRequest, res, next) => {
  try { res.json(await nis2Service.getRegistration(req.params.id)); } catch (error) { next(error); }
});

nis2Router.post('/questionnaires', authenticate, authorizeEntityWrite('controls'), validateBody(CreateNis2QuestionnaireVersionSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await nis2Service.createQuestionnaireVersion(req.body, req.userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

nis2Router.post('/questionnaires/default', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
  try {
    const result = await nis2Service.ensureDefaultQuestionnaire(req.userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

nis2Router.post('/assessments', authenticate, authorizeEntityWrite('controls'), validateBody(CreateNis2AssessmentSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await nis2Service.createApplicabilityAssessment(req.body, req.userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

nis2Router.post('/assessments/:id/submit', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
  try {
    const result = await nis2Service.submitAssessment(req.params.id, req.userId ?? 'system');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

nis2Router.post('/assessments/:id/approve', authenticate, authorizeEntityWrite('controls'), validateBody(ApproveNis2AssessmentSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await nis2Service.approveAssessment(req.params.id, req.userId ?? 'system', req.body.result, req.body.justification);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

nis2Router.post('/registrations', authenticate, authorizeEntityWrite('controls'), validateBody(CreateNis2RegistrationSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await nis2Service.createRegistration(req.body, req.userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

nis2Router.post('/registrations/:id/changes', authenticate, authorizeEntityWrite('controls'), validateBody(CreateNis2RegistrationChangeSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await nis2Service.recordRegistrationChange(req.params.id, req.body, req.userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

nis2Router.post('/measures-catalogue/ensure', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
  try {
    const result = await nis2Service.ensureMeasuresCatalogue(req.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
