import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import {
  AssetRelationCreateSchema,
  ControlImplementationSchema,
  CreateAssetSchema,
  CreateControlSchema,
  CreateIncidentSchema,
  CreateRiskAssessmentSchema,
  CreateRiskControlSchema,
  CreateRiskSchema,
  UpdateRiskControlSchema,
} from 'shared';

const routeContractCases: Array<{ name: string; schema: z.ZodTypeAny; valid: object; invalid: object }> = [
  {
    name: 'Asset',
    schema: CreateAssetSchema,
    valid: { name: 'Core Router', assetTypeId: '11111111-1111-4111-8111-111111111111' },
    invalid: { name: '', assetTypeId: 'not-a-uuid' },
  },
  {
    name: 'AssetDeterministicDemoIds',
    schema: CreateAssetSchema,
    valid: { name: 'Demo Router', assetTypeId: 'demo-helio-assettype-network-device', organizationUnitId: 'demo-helio-org-it', technicalOperatorId: 'demo-helio-user-asset' },
    invalid: { name: 'Demo Router', assetTypeId: 'not-a-uuid', organizationUnitId: 'org-it' },
  },
  {
    name: 'AssetRelation',
    schema: AssetRelationCreateSchema,
    valid: { targetAssetId: '11111111-1111-4111-8111-111111111111', relationshipType: 'depends_on' },
    invalid: { targetAssetId: 'not-a-uuid', relationshipType: '' },
  },
  {
    name: 'Risk',
    schema: CreateRiskSchema,
    valid: { title: 'Outage', description: 'Outage risk', possibleImpact: 'Downtime', likelihood: 3, impact: 4, assessorId: 'assessor', riskOwnerId: 'owner', nextReviewDate: '2026-12-31T00:00:00.000Z', justification: 'Required' },
    invalid: { title: 'Outage', description: 'Outage risk', possibleImpact: 'Downtime', likelihood: 6, impact: 4, assessorId: '', riskOwnerId: 'owner', nextReviewDate: 'bad-date', justification: '' },
  },
  {
    name: 'Control',
    schema: CreateControlSchema,
    valid: { catalogId: 'iso27001', catalogVersion: '2022', title: 'Backup monitoring', description: 'Monitor backups', controlGoal: 'Detect failures' },
    invalid: { name: 'legacy-control', controlType: 'parallel-model' },
  },
  {
    name: 'ControlImplementation',
    schema: ControlImplementationSchema,
    valid: { controlId: '11111111-1111-4111-8111-111111111111', scopeId: '22222222-2222-4222-8222-222222222222', responsibleUserId: 'owner' },
    invalid: { controlId: '11111111-1111-4111-8111-111111111111', responsibleUserId: 'owner' },
  },
  {
    name: 'RiskControl',
    schema: CreateRiskControlSchema,
    valid: { riskId: '11111111-1111-4111-8111-111111111111', controlImplementationId: '22222222-2222-4222-8222-222222222222', role: 'preventive', mitigationDimension: 'both' },
    invalid: { riskId: '11111111-1111-4111-8111-111111111111', controlImplementationId: '22222222-2222-4222-8222-222222222222', role: 'invalid', mitigationDimension: 'both' },
  },
  {
    name: 'RiskControlUpdate',
    schema: UpdateRiskControlSchema,
    valid: { status: 'inactive' },
    invalid: { existingControls: ['legacy'] },
  },
  {
    name: 'RiskAssessment',
    schema: CreateRiskAssessmentSchema,
    valid: { riskId: '11111111-1111-4111-8111-111111111111', riskMethodVersionId: '22222222-2222-4222-8222-222222222222', likelihood: 3, impact: 4, inherentRisk: 'high', residualRisk: 'medium', targetRisk: 'low', assessorId: 'assessor', nextReviewDate: '2026-12-31T00:00:00.000Z', justification: 'Required' },
    invalid: { riskId: '11111111-1111-4111-8111-111111111111', riskMethodVersionId: '22222222-2222-4222-8222-222222222222', likelihood: 0, impact: 4, inherentRisk: '', residualRisk: '', targetRisk: '', assessorId: '', nextReviewDate: 'bad-date', justification: '' },
  },
  {
    name: 'Incident',
    schema: CreateIncidentSchema,
    valid: { title: 'Malware alert', description: 'EDR alert', detectionTime: '2026-07-26T10:00:00.000Z', knowledgeTime: '2026-07-26T10:05:00.000Z', incidentManagerId: 'manager' },
    invalid: { title: '', description: '', detectionTime: 'bad-date', knowledgeTime: '2026-07-26T10:05:00.000Z', incidentManagerId: '' },
  },
];

describe('Phase 6 shared DTO/backend validation contracts', () => {
  test.each(routeContractCases)('%s schema is accepted by backend validateBody and rejects invalid payloads', async ({ schema, valid, invalid }) => {
    const app = express();
    app.use(express.json());
    app.post('/contract', validateBody(schema), (req, res) => res.status(201).json({ received: req.body }));

    await request(app).post('/contract').send(valid).expect(201);
    await request(app).post('/contract').send(invalid).expect(400);
  });
});
