/**
 * Item 5: `/admin/email-gateway/*` route tests.
 *
 *  - non-admin denial (403)
 *  - secret redaction in responses (no mailbox/SMTP/Exchange secrets or tokens)
 *  - structured 400 from the Zod body schema
 *  - scheduler restart on a config update
 *  - rejected invalid IMAP OAuth2/provider combination
 *  - rejected inline secret reference
 */
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler';

const mockEmailGatewayService = {
  getConfig: jest.fn(),
  updateConfig: jest.fn(),
  testInbound: jest.fn(),
  testSmtp: jest.fn(),
  pollInbound: jest.fn(),
  lastPollStatus: jest.fn(),
  listMessages: jest.fn(),
  drainConfirmations: jest.fn(),
  closeSmtpTransports: jest.fn(),
};

const schedulerRestart = jest.fn();
const mockGetEmailGatewayScheduler = jest.fn(() => ({ restart: schedulerRestart }));

jest.mock('../services/emailGateway.service', () => ({ emailGatewayService: mockEmailGatewayService }));
jest.mock('../services/emailGateway.scheduler', () => ({ getEmailGatewayScheduler: () => mockGetEmailGatewayScheduler() }));

let adminAllowed = true;
jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'admin-actor-id';
    next();
  },
}));
jest.mock('../middleware/entityAuth', () => ({
  requireAdminAccess: (_req: any, res: any, next: any) => {
    if (!adminAllowed) {
      res.status(403).json({ success: false, error: { message: 'Admin access required', code: 'FORBIDDEN' } });
      return;
    }
    next();
  },
}));

jest.mock('../services/admin.service', () => ({ adminService: {} }));
jest.mock('../services/reminder.service', () => ({ reminderService: {} }));
jest.mock('../services/reminder.scheduler', () => ({ getReminderScheduler: jest.fn() }));
jest.mock('../services/fiscalYear.service', () => ({ fiscalYearService: {} }));
jest.mock('../config/database', () => ({ prisma: {}, getSafeDatabaseConfig: jest.fn() }));
jest.mock('../services/audit.service', () => ({ auditService: {}, AuditService: {} }));
jest.mock('../services/auditIntegrity.service', () => ({ auditIntegrityService: {} }));
jest.mock('../services/databaseBackup.service', () => ({ databaseBackupService: {} }));
jest.mock('../services/ticket.service', () => ({ ticketService: {} }));
jest.mock('../services/sla.service', () => ({ slaService: {} }));
jest.mock('../services/sla.scheduler', () => ({ getSlaScheduler: jest.fn() }));
jest.mock('../services/navigationConfig.service', () => ({ navigationConfigService: {} }));
jest.mock('../services/navigationView.service', () => ({ navigationViewService: {} }));
jest.mock('../services/ai.service', () => ({ aiService: {} }));
jest.mock('../services/ai.scheduler', () => ({ getAiAssistantScheduler: jest.fn() }));

import { adminRouter } from '../routes/admin.routes';

const app = express();
app.use(express.json());
app.use(adminRouter);
app.use(errorHandler);

const sanitizedConfig = {
  id: 'gateway-1',
  enabled: true,
  inboundProvider: 'imap',
  imapHost: 'imap.example.com',
  imapPasswordConfigured: true,
  smtpPasswordConfigured: true,
  exchangeClientSecretRefConfigured: true,
  imapPassword: 'imap-secret-value',
  smtpPassword: 'smtp-secret-value',
  exchangeClientSecretRef: 'env:EXCHANGE_SECRET',
  exchangeAccessToken: 'a.b.c-token',
};

describe('Item 5: admin email-gateway routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adminAllowed = true;
    mockGetEmailGatewayScheduler.mockReturnValue({ restart: schedulerRestart });
    schedulerRestart.mockResolvedValue(undefined);
    mockEmailGatewayService.getConfig.mockResolvedValue({
      ...sanitizedConfig,
      imapPassword: undefined,
      smtpPassword: undefined,
      exchangeClientSecretRef: undefined,
      exchangeAccessToken: undefined,
    });
    mockEmailGatewayService.updateConfig.mockResolvedValue({
      id: 'gateway-1',
      enabled: true,
      imapPasswordConfigured: true,
      smtpPasswordConfigured: true,
      exchangeClientSecretRefConfigured: true,
    });
    mockEmailGatewayService.testInbound.mockResolvedValue({ ok: true, provider: 'imap', messages: 0 });
    mockEmailGatewayService.testSmtp.mockResolvedValue({ ok: true });
    mockEmailGatewayService.pollInbound.mockResolvedValue({ ok: true, processed: 0 });
    mockEmailGatewayService.lastPollStatus.mockResolvedValue({ enabled: true, provider: 'imap' });
    mockEmailGatewayService.listMessages.mockResolvedValue([]);
  });

  it('denies non-admin callers with 403 on every email-gateway endpoint', async () => {
    adminAllowed = false;
    await request(app).get('/email-gateway/config').expect(403);
    await request(app).get('/email-gateway/status').expect(403);
    await request(app).get('/email-gateway/messages').expect(403);
    await request(app).post('/email-gateway/test-inbound').expect(403);
    await request(app).post('/email-gateway/test-smtp').expect(403);
    await request(app).post('/email-gateway/poll-now').expect(403);
    await request(app).put('/email-gateway/config').send({ enabled: true }).expect(403);
    expect(mockEmailGatewayService.updateConfig).not.toHaveBeenCalled();
    expect(schedulerRestart).not.toHaveBeenCalled();
  });

  it('returns a config payload with no secrets or tokens', async () => {
    const response = await request(app).get('/email-gateway/config').expect(200);
    const payload = JSON.stringify(response.body);
    expect(response.body.imapPassword).toBeUndefined();
    expect(response.body.smtpPassword).toBeUndefined();
    expect(response.body.exchangeClientSecretRef).toBeUndefined();
    expect(response.body.exchangeAccessToken).toBeUndefined();
    expect(payload).not.toContain('imap-secret-value');
    expect(payload).not.toContain('smtp-secret-value');
    expect(payload).not.toContain('env:EXCHANGE_SECRET');
    expect(response.body).toMatchObject({ imapPasswordConfigured: true, smtpPasswordConfigured: true });
  });

  it('does not leak secrets in the config-update response', async () => {
    await request(app).put('/email-gateway/config').send({ enabled: true }).expect(200);
    expect(mockEmailGatewayService.updateConfig).toHaveBeenCalledWith({ enabled: true }, 'admin-actor-id');
    const payload = JSON.stringify(mockEmailGatewayService.updateConfig.mock.results[0].value);
    expect(payload).not.toContain('imap-secret-value');
    expect(payload).not.toContain('smtp-secret-value');
    expect(payload).not.toContain('env:EXCHANGE_SECRET');
  });

  it('returns a structured 400 when the body fails the Zod schema', async () => {
    const response = await request(app)
      .put('/email-gateway/config')
      .send({ inboundProvider: 'pop3' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.details)).toBe(true);
    expect(response.body.error.details[0].field).toBe('inboundProvider');
    expect(mockEmailGatewayService.updateConfig).not.toHaveBeenCalled();
    expect(schedulerRestart).not.toHaveBeenCalled();
  });

  it('returns a structured 400 when the port is out of range', async () => {
    const response = await request(app)
      .put('/email-gateway/config')
      .send({ imapPort: 70000 })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].field).toBe('imapPort');
    expect(mockEmailGatewayService.updateConfig).not.toHaveBeenCalled();
  });

  it('rejects imapAuthType=oauth2 combined with inboundProvider=imap (Zod superRefine)', async () => {
    const response = await request(app)
      .put('/email-gateway/config')
      .send({ inboundProvider: 'imap', imapAuthType: 'oauth2' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.map((d: any) => d.field)).toContain('imapAuthType');
    expect(mockEmailGatewayService.updateConfig).not.toHaveBeenCalled();
  });

  it.each([
    'raw-inline-client-secret',
    'file:../../etc/passwd',
    'file:/etc/passwd',
    'env:BAD-NAME',
  ])('rejects an invalid inline/secret reference %s at the schema boundary', async (ref) => {
    const response = await request(app)
      .put('/email-gateway/config')
      .send({ exchangeClientSecretRef: ref })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockEmailGatewayService.updateConfig).not.toHaveBeenCalled();
  });

  it('restarts the scheduler after a successful config update', async () => {
    await request(app).put('/email-gateway/config').send({ pollIntervalMinutes: 15 }).expect(200);

    expect(mockEmailGatewayService.updateConfig).toHaveBeenCalledWith({ pollIntervalMinutes: 15 }, 'admin-actor-id');
    expect(mockGetEmailGatewayScheduler).toHaveBeenCalledTimes(1);
    expect(schedulerRestart).toHaveBeenCalledTimes(1);
  });

  it('does not restart the scheduler when the service rejects the update', async () => {
    mockEmailGatewayService.updateConfig.mockRejectedValue(
      Object.assign(new Error('imapAuthType=oauth2 requires inboundProvider=exchange'), { statusCode: 400, name: 'AppError' }),
    );

    await request(app).put('/email-gateway/config').send({ enabled: true }).expect(400);
    expect(schedulerRestart).not.toHaveBeenCalled();
  });

  it('serves status, messages, and test endpoints through the service', async () => {
    mockEmailGatewayService.lastPollStatus.mockResolvedValue({ enabled: true, provider: 'imap', lastPollMessage: 'processed=0 skipped=0 failed=0' });
    mockEmailGatewayService.listMessages.mockResolvedValue([{ id: 'msg-1', direction: 'inbound' }]);

    const status = await request(app).get('/email-gateway/status').expect(200);
    expect(status.body).toMatchObject({ enabled: true, provider: 'imap' });
    expect(status.body.lastPollMessage).not.toContain('@');

    const messages = await request(app).get('/email-gateway/messages?limit=10').expect(200);
    expect(mockEmailGatewayService.listMessages).toHaveBeenCalledWith(10);
    expect(messages.body[0].id).toBe('msg-1');

    await request(app).post('/email-gateway/test-inbound').expect(200);
    await request(app).post('/email-gateway/test-smtp').expect(200);
    await request(app).post('/email-gateway/poll-now').expect(200);
    expect(mockEmailGatewayService.pollInbound).toHaveBeenCalledWith('admin-actor-id');
  });
});
