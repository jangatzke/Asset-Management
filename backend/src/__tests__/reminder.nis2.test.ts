/**
 * Focused unit tests for the NIS2 registration review reminder rule in
 * ReminderService. The rule derives a review due date from lastReviewDate + 1 year,
 * falling back to the registration deadline when no review has been recorded.
 */
jest.mock('../config/database', () => {
  const prisma: any = {
    reminderConfig: {
      findFirst: jest.fn().mockResolvedValue({ id: 'cfg-1', enabled: true, intervalMinutes: 1440, lookAheadDays: 0, reminderSubjectPrefix: '[ISMS Reminder]' }),
      create: jest.fn(),
      update: jest.fn(),
    },
    nis2Registration: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    reminderDeliveryLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return { prisma };
});
jest.mock('../services/audit.service', () => ({
  auditService: { logEventStandalone: jest.fn().mockResolvedValue(undefined) },
}));

import { prisma } from '../config/database';
import { ReminderService, nis2RegistrationReviewDueDate, NIS2_REGISTRATION_REMINDER_RESOURCE } from '../services/reminder.service';

const mockPrisma = prisma as any;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('NIS2 registration review reminder rule', () => {
  const service = new ReminderService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.reminderConfig.findFirst.mockResolvedValue({ id: 'cfg-1', enabled: true, intervalMinutes: 1440, lookAheadDays: 0, reminderSubjectPrefix: '[ISMS Reminder]' });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.reminderDeliveryLog.create.mockResolvedValue({});
  });

  it('derives the review date as lastReviewDate plus one year and falls back to the registration deadline', () => {
    expect(nis2RegistrationReviewDueDate({ lastReviewDate: new Date('2025-06-01T00:00:00Z') })).toEqual(new Date(new Date('2025-06-01T00:00:00Z').getTime() + 365 * DAY_MS));
    expect(nis2RegistrationReviewDueDate({ lastReviewDate: null, deadline: new Date('2026-03-01T00:00:00Z') })).toEqual(new Date('2026-03-01T00:00:00Z'));
    expect(nis2RegistrationReviewDueDate({ lastReviewDate: null, deadline: null })).toBeNull();
  });

  it('collects only registrations whose derived review date falls inside the look-ahead window', async () => {
    const now = Date.now();
    mockPrisma.nis2Registration.findMany.mockResolvedValue([
      // Reviewed ~364 days ago -> review due tomorrow, inside a 2-day look-ahead.
      { id: 'due-soon', entityType: 'ESSENTIAL', status: 'submitted', contactPerson: 'Ops', lastReviewDate: new Date(now - 364 * DAY_MS), deadline: null },
      // Reviewed two years ago -> review overdue for a year, must escalate.
      { id: 'overdue', entityType: 'IMPORTANT', status: 'pending', lastReviewDate: new Date(now - 730 * DAY_MS), deadline: null },
      // No review history but registration deadline far in the future -> not due.
      { id: 'far-future', entityType: 'ESSENTIAL', status: 'pending', lastReviewDate: null, deadline: new Date(now + 200 * DAY_MS) },
      // Nothing derivable at all -> never due.
      { id: 'no-dates', entityType: 'ESSENTIAL', status: 'pending', lastReviewDate: null, deadline: null },
    ]);

    const items = await service.collectDueItems(NIS2_REGISTRATION_REMINDER_RESOURCE, 2);

    expect(mockPrisma.nis2Registration.findMany).toHaveBeenCalledWith({
      where: { isArchived: false, status: { notIn: ['completed', 'closed', 'cancelled', 'approved'] } },
    });
    const byId = new Map(items.map((item: any) => [item.id, item]));
    expect([...byId.keys()].sort()).toEqual(['due-soon', 'overdue']);
    expect(byId.get('due-soon')).toMatchObject({ resource: NIS2_REGISTRATION_REMINDER_RESOURCE, entityType: 'Nis2Registration', escalation: false });
    expect(byId.get('overdue')).toMatchObject({ escalation: true });
    // Sorted by derived due date ascending.
    expect(items.map((item: any) => item.id)).toEqual(['overdue', 'due-soon']);
  });

  it('runs the NIS2 resource through the standard delivery logging path without sending e-mail', async () => {
    const now = Date.now();
    mockPrisma.nis2Registration.findMany.mockResolvedValue([
      { id: 'reg-1', entityType: 'ESSENTIAL', status: 'pending', lastReviewDate: new Date(now - 730 * DAY_MS), deadline: null },
    ]);

    const result = await service.runForResource(NIS2_REGISTRATION_REMINDER_RESOURCE, 'user-1', { sendEmail: false });

    expect(result.count).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mockPrisma.reminderDeliveryLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ resource: NIS2_REGISTRATION_REMINDER_RESOURCE, entityType: 'Nis2Registration', entityId: 'reg-1', status: 'generated' }),
    }));
  });
});
