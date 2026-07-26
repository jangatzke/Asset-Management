const mockPrisma: any = {
  fiscalYearConfig: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));

import { FiscalYearService } from '../services/fiscalYear.service';

describe('FiscalYearService', () => {
  const service = new FiscalYearService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns existing fiscal-year config', async () => {
    const config = { id: 'fy-1', startMonth: 4, startDay: 1, timezone: 'Europe/Berlin' };
    mockPrisma.fiscalYearConfig.findFirst.mockResolvedValue(config);

    await expect(service.getConfig()).resolves.toEqual(config);
    expect(mockPrisma.fiscalYearConfig.create).not.toHaveBeenCalled();
  });

  it('creates default config when none exists', async () => {
    const config = { id: 'fy-1', startMonth: 1, startDay: 1, timezone: 'Europe/Berlin' };
    mockPrisma.fiscalYearConfig.findFirst.mockResolvedValue(null);
    mockPrisma.fiscalYearConfig.create.mockResolvedValue(config);

    await expect(service.getConfig()).resolves.toEqual(config);
    expect(mockPrisma.fiscalYearConfig.create).toHaveBeenCalledWith({ data: { startMonth: 1, startDay: 1, timezone: 'Europe/Berlin' } });
  });

  it('maps missing migration table errors to actionable setup error', async () => {
    mockPrisma.fiscalYearConfig.findFirst.mockRejectedValue({ code: 'P2021', meta: { table: 'public.fiscal_year_configs' } });

    await expect(service.getConfig()).rejects.toMatchObject({ statusCode: 503 });
    await expect(service.getConfig()).rejects.toThrow('npm run db:deploy');
  });

  it('calculates calendar fiscal-year periods', () => {
    const period = service.getPeriodForDate(new Date('2026-07-25T12:00:00Z'), { startMonth: 1, startDay: 1 });

    expect(period.label).toBe('2026');
    expect(period.periodStart.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(period.periodEnd.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('calculates shifted fiscal-year periods', () => {
    const period = service.getPeriodForDate(new Date('2026-03-31T23:00:00Z'), { startMonth: 4, startDay: 1 });

    expect(period.label).toBe('FY2026');
    expect(period.periodStart.toISOString()).toBe('2025-04-01T00:00:00.000Z');
    expect(period.periodEnd.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });
});
