import { PrismaClient } from '@prisma/client';
import { AuditService, AuditEventParams } from '../services/audit.service';

// Mock Prisma Client
const mockPrisma = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

describe('AuditService', () => {
  let auditService: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    auditService = new AuditService();
  });

  describe('logEventStandalone', () => {
    it('should create an audit log entry with minimal data', async () => {
      const event: AuditEventParams & { ipAddress?: string; userAgent?: string } = {
        userId: 'user-123',
        action: 'LOGIN',
        entityType: 'User',
        entityId: 'user-123',
        details: 'Successful login',
      };

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        ...event,
        timestamp: new Date(),
        userName: null,
        oldValue: null,
        newValue: null,
        ipAddress: null,
        userAgent: null,
      });

      await auditService.logEventStandalone(mockPrisma as any, event);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          ...event,
          timestamp: undefined, // logEventStandalone does not set timestamp explicitly (DB default)
        },
      });
    });

    it('should create an audit log entry with full data', async () => {
      const event: AuditEventParams & { ipAddress?: string; userAgent?: string } = {
        userId: 'user-123',
        userName: 'John Doe',
        action: 'ASSET_CREATE',
        entityType: 'Asset',
        entityId: 'asset-456',
        details: 'Created new server asset',
        oldValue: null,
        newValue: { name: 'Server01' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-2',
        ...event,
        timestamp: new Date(),
      });

      await auditService.logEventStandalone(mockPrisma as any, event);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            action: 'ASSET_CREATE',
            entityType: 'Asset',
            entityId: 'asset-456',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          }),
        })
      );
    });

    it('should handle old value and new value for change tracking', async () => {
      const event: AuditEventParams & { ipAddress?: string; userAgent?: string } = {
        userId: 'admin-1',
        action: 'PERMISSION_CHANGE',
        entityType: 'User',
        entityId: 'user-789',
        details: 'Role changed from employee to admin',
        oldValue: { roles: ['employee'] },
        newValue: { roles: ['admin'] },
      };

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-3',
        ...event,
        timestamp: new Date(),
        userName: null,
        ipAddress: null,
        userAgent: null,
      });

      await auditService.logEventStandalone(mockPrisma as any, event);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            oldValue: { roles: ['employee'] },
            newValue: { roles: ['admin'] },
          }),
        })
      );
    });

    it('should handle null values for optional fields', async () => {
      const event: AuditEventParams & { ipAddress?: string; userAgent?: string } = {
        userId: 'user-123',
        action: 'LOGIN',
        entityType: 'User',
        entityId: 'user-123',
      };

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-4',
        ...event,
        timestamp: new Date(),
        userName: null,
        details: null,
        oldValue: null,
        newValue: null,
        ipAddress: null,
        userAgent: null,
      });

      await auditService.logEventStandalone(mockPrisma as any, event);

      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('queryAuditLog', () => {
    it('should return paginated audit log entries', async () => {
      const mockEntries = [
        {
          id: 'audit-1',
          timestamp: new Date(),
          userId: 'user-123',
          userName: 'John Doe',
          action: 'LOGIN',
          entityType: 'User',
          entityId: 'user-123',
          details: 'Successful login',
          oldValue: null,
          newValue: null,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockEntries);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await auditService.queryAuditLog(mockPrisma as any, {}, 1, 10);

      expect(result.entries).toEqual(mockEntries);
      expect(result.page).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should filter by entity type', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await auditService.queryAuditLog(mockPrisma as any, { entityType: 'Asset' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'Asset',
          }),
        })
      );
    });

    it('should filter by action', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await auditService.queryAuditLog(mockPrisma as any, { action: 'LOGIN' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'LOGIN',
          }),
        })
      );
    });

    it('should filter by user ID', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await auditService.queryAuditLog(mockPrisma as any, { userId: 'user-123' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');

      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await auditService.queryAuditLog(mockPrisma as any, { from, to });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({
              gte: from,
              lte: to,
            }),
          }),
        })
      );
    });

    it('should combine multiple filters', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await auditService.queryAuditLog(mockPrisma as any, {
        entityType: 'Asset',
        action: 'ASSET_CREATE',
        userId: 'user-123',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'Asset',
            action: 'ASSET_CREATE',
            userId: 'user-123',
          }),
        })
      );
    });
  });

  describe('exportAuditLog', () => {
    it('should export audit log entries', async () => {
      const mockEntries = [
        {
          id: 'audit-1',
          timestamp: new Date(),
          userId: 'user-123',
          userName: 'John Doe',
          action: 'LOGIN',
          entityType: 'User',
          entityId: 'user-123',
          details: 'Successful login',
          oldValue: null,
          newValue: null,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockEntries);

      const result = await auditService.exportAuditLog(mockPrisma as any, {});

      expect(result).toEqual(mockEntries);
    });

    it('should export with filters applied', async () => {
      const mockEntries = [];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockEntries);

      await auditService.exportAuditLog(mockPrisma as any, {
        entityType: 'Asset',
        from: new Date('2024-01-01'),
        to: new Date('2024-12-31'),
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'Asset',
            timestamp: expect.objectContaining({
              gte: new Date('2024-01-01'),
              lte: new Date('2024-12-31'),
            }),
          }),
        })
      );
    });
  });

  describe('exportAuditLogAsCSV', () => {
    it('should export audit log as CSV string', async () => {
      const mockEntries = [
        {
          id: 'audit-1',
          timestamp: new Date(),
          userId: 'user-123',
          userName: 'John Doe',
          action: 'LOGIN',
          entityType: 'User',
          entityId: 'user-123',
          details: 'Successful login',
          oldValue: null,
          newValue: null,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockEntries);

      const csv = await auditService.exportAuditLogAsCSV(mockPrisma as any, {});

      expect(csv).toContain('id');
      expect(csv).toContain('timestamp');
      expect(csv).toContain('userId');
      expect(csv).toContain('action');
    });
  });

  describe('extractRequestInfo', () => {
    it('should extract IP and user agent from request', () => {
      const mockReq = {
        ip: '192.168.1.100',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      } as any;

      const info = AuditService.extractRequestInfo(mockReq);

      expect(info.ipAddress).toBe('192.168.1.100');
      expect(info.userAgent).toBe('Mozilla/5.0');
    });
  });
});
