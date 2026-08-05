import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const FISCAL_YEAR_MIGRATION_HINT = 'Fiscal-year tables are missing. Run `npm run db:deploy` from the backend directory to apply Prisma migrations, including 20260725190000_cost_planning.';

export interface FiscalYearConfigDto {
  id: string;
  startMonth: number;
  startDay: number;
  timezone: string;
  updatedByUserId?: string | null;
}

export interface FiscalYearPeriod {
  label: string;
  periodStart: Date;
  periodEnd: Date;
}

function validateMonthDay(startMonth: number, startDay: number): void {
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    throw new AppError('startMonth must be between 1 and 12', 400);
  }
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][startMonth - 1];
  if (!Number.isInteger(startDay) || startDay < 1 || startDay > daysInMonth) {
    throw new AppError('startDay is invalid for the selected month', 400);
  }
}

function toUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function isMissingFiscalYearTableError(error: unknown): boolean {
  const candidate = error as { code?: string; meta?: { modelName?: string; table?: string }; message?: string };
  const message = candidate.message ?? '';
  return candidate.code === 'P2021'
    || candidate.meta?.modelName === 'FiscalYearConfig'
    || candidate.meta?.table === 'public.fiscal_year_configs'
    || message.includes('public.fiscal_year_configs')
    || message.includes('fiscal_year_configs');
}

export function mapFiscalYearPersistenceError(error: unknown): never {
  if (isMissingFiscalYearTableError(error)) {
    throw new AppError(FISCAL_YEAR_MIGRATION_HINT, 503);
  }
  throw error;
}

export class FiscalYearService {
  async getConfig(): Promise<FiscalYearConfigDto> {
    try {
      const existing = await prisma.fiscalYearConfig.findFirst({ orderBy: { createdAt: 'asc' } });
      if (existing) return existing;
      return await prisma.fiscalYearConfig.create({ data: { startMonth: 1, startDay: 1, timezone: 'Europe/Berlin' } });
    } catch (error) {
      return mapFiscalYearPersistenceError(error);
    }
  }

  async updateConfig(input: { startMonth: number; startDay: number; timezone?: string }, userId?: string): Promise<FiscalYearConfigDto> {
    validateMonthDay(input.startMonth, input.startDay);
    const config = await this.getConfig();
    return prisma.fiscalYearConfig.update({
      where: { id: config.id },
      data: {
        startMonth: input.startMonth,
        startDay: input.startDay,
        timezone: input.timezone || 'Europe/Berlin',
        updatedByUserId: userId,
      },
    });
  }

  getPeriodForDate(date: Date, config: Pick<FiscalYearConfigDto, 'startMonth' | 'startDay'>): FiscalYearPeriod {
    validateMonthDay(config.startMonth, config.startDay);
    const calendarYear = date.getUTCFullYear();
    const fiscalStartThisYear = toUtcDate(calendarYear, config.startMonth, config.startDay);
    const startYear = date >= fiscalStartThisYear ? calendarYear : calendarYear - 1;
    const periodStart = toUtcDate(startYear, config.startMonth, config.startDay);
    const periodEnd = toUtcDate(startYear + 1, config.startMonth, config.startDay);
    const label = config.startMonth === 1 && config.startDay === 1 ? String(startYear) : `${startYear}/${startYear + 1}`;
    return { label, periodStart, periodEnd };
  }

  async getFiscalYearForDate(date: Date = new Date()): Promise<FiscalYearPeriod> {
    const config = await this.getConfig();
    return this.getPeriodForDate(date, config);
  }

  async getFiscalYearByLabel(label: string): Promise<FiscalYearPeriod> {
    const config = await this.getConfig();
    const isCalendar = config.startMonth === 1 && config.startDay === 1;
    let startYear: number;
    if (isCalendar) {
      startYear = Number(label);
      if (!Number.isInteger(startYear) || startYear < 1900 || startYear > 9999) {
        throw new AppError('Invalid fiscal year label', 400);
      }
    } else {
      const parts = label.split('/');
      if (parts.length !== 2) {
        throw new AppError('Invalid fiscal year label', 400);
      }
      const first = Number(parts[0]);
      if (!Number.isInteger(first) || first < 1900 || first > 9999) {
        throw new AppError('Invalid fiscal year label', 400);
      }
      startYear = first;
    }
    return {
      label: isCalendar ? String(startYear) : `${startYear}/${startYear + 1}`,
      periodStart: toUtcDate(startYear, config.startMonth, config.startDay),
      periodEnd: toUtcDate(startYear + 1, config.startMonth, config.startDay),
    };
  }

  async listSelectableYears(anchorDate: Date = new Date(), pastCount = 3, futureCount = 3) {
    const config = await this.getConfig();
    const current = this.getPeriodForDate(anchorDate, config);
    const baseYear = current.periodStart.getUTCFullYear();
    const years = [];
    for (let offset = -pastCount; offset <= futureCount; offset += 1) {
      const startYear = baseYear + offset;
      const periodStart = toUtcDate(startYear, config.startMonth, config.startDay);
      years.push(this.getPeriodForDate(periodStart, config));
    }
    return { config, current, next: this.getPeriodForDate(current.periodEnd, config), years };
  }
}

export const fiscalYearService = new FiscalYearService();
