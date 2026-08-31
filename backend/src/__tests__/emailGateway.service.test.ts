import { createMockPrismaClient } from '../test/prisma-mock';

var mockPrisma = createMockPrismaClient();

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/audit.service', () => ({ auditService: { logEventStandalone: jest.fn().mockResolvedValue({}) } }));
jest.mock('../services/ticket.service', () => ({ ticketService: { create: jest.fn(), comment: jest.fn() } }));

const { emailGatewayService } = require('../services/emailGateway.service');

describe('EmailGatewayService configuration security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue({
      id: 'gateway-1', enabled: false, inboundProvider: 'imap',
      imapPassword: 'imap-secret', smtpPassword: 'smtp-secret', exchangeClientSecretRef: 'env:EXCHANGE_SECRET',
      createdAt: new Date(), updatedAt: new Date(),
    });
  });

  it('never exposes mailbox, SMTP, or Exchange secret values in configuration responses', async () => {
    const config = await emailGatewayService.getConfig();

    expect(config).not.toHaveProperty('imapPassword');
    expect(config).not.toHaveProperty('smtpPassword');
    expect(config).not.toHaveProperty('exchangeClientSecretRef');
    expect(config).toMatchObject({
      imapPasswordConfigured: true,
      smtpPasswordConfigured: true,
      exchangeClientSecretRefConfigured: true,
    });
  });

  it('rejects an unsupported inbound provider before changing configuration', async () => {
    await expect(emailGatewayService.updateConfig({ inboundProvider: 'pop3' }, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.emailGatewayConfig.update).not.toHaveBeenCalled();
  });

  it('rejects polling intervals outside the bounded operational range', async () => {
    await expect(emailGatewayService.updateConfig({ pollIntervalMinutes: 0 }, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.emailGatewayConfig.update).not.toHaveBeenCalled();
  });
});
