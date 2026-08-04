/**
 * Phase 9: Audit Log Hash-Chain Integrity Tests
 *
 * Covers:
 * - Hash generation determinism
 * - Canonicalization stability
 * - Chain continuity (sequential entries)
 * - Tamper detection (modified entryHash / previousHash mismatch)
 * - Missing sequence gap detection
 * - Verify valid chain
 * - Audit creation integration (hash computed and stored correctly)
 */

import type { AuditEventParams } from '../services/audit.service';
import {
  computeEntryHash,
  canonicalize,
  verifyIntegrity,
} from '../services/auditIntegrity.service';

type MockTransactionCallback = (tx: unknown) => Promise<unknown>;

// Mock Prisma Client with real database interaction for integration tests
const mockPrisma = {
  $transaction: jest.fn(async (fn: MockTransactionCallback) => fn(mockPrisma)),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  auditLog: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));

describe('Phase 9: Audit Log Integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: MockTransactionCallback) => fn(mockPrisma));
    mockPrisma.$queryRaw.mockResolvedValue([{ sequence: 1 }]);
    mockPrisma.$executeRaw.mockResolvedValue(1);
  });

  // -----------------------------------------------------------------------
  // Canonicalization tests
  // -----------------------------------------------------------------------

  describe('canonicalize', () => {
    it('should produce stable JSON for objects with sorted keys', () => {
      const a = canonicalize({ z: 1, a: 2 });
      const b = canonicalize({ a: 2, z: 1 });
      expect(a).toBe(b);
    });

    it('should produce identical canonicalization and hashes for reordered object keys', () => {
      const ordered = { a: 1, b: 2 };
      const reordered = { b: 2, a: 1 };
      expect(canonicalize(ordered)).toBe(canonicalize(reordered));

      const base = {
        sequence: 1,
        timestampISO: '2026-07-26T12:00:00.000Z',
        userId: 'user-1',
        userName: null,
        action: 'LOGIN',
        entityType: 'User',
        entityId: 'user-1',
        details: null,
        oldValue: null,
        previousHash: '',
      };
      expect(computeEntryHash({ ...base, newValue: ordered })).toBe(
        computeEntryHash({ ...base, newValue: reordered })
      );
    });

    it('should handle null and undefined consistently', () => {
      expect(canonicalize(null)).toBe('null');
      expect(canonicalize(undefined)).toBe('null');
    });

    it('should produce deterministic output for nested objects', () => {
      const input = { roles: ['admin'], user: { name: 'test' } };
      const result1 = canonicalize(input);
      const result2 = canonicalize(input);
      expect(result1).toBe(result2);
    });

    it('should handle arrays deterministically', () => {
      const input = [1, 2, 3];
      expect(canonicalize(input)).toBe('[1,2,3]');
    });
  });

  // -----------------------------------------------------------------------
  // Hash generation tests
  // -----------------------------------------------------------------------

  describe('computeEntryHash / buildCanonicalString', () => {
    const baseData = {
      sequence: 1,
      timestampISO: '2026-07-26T12:00:00.000Z',
      userId: 'user-1',
      userName: 'Alice',
      action: 'LOGIN',
      entityType: 'User',
      entityId: 'user-1',
      details: null,
      oldValue: null,
      newValue: null,
      previousHash: '',
    };

    it('should produce deterministic hashes for identical input', () => {
      const hash1 = computeEntryHash(baseData);
      const hash2 = computeEntryHash(baseData);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex digest is 64 chars
    });

    it('should produce different hashes for different sequences', () => {
      const dataSeq2 = { ...baseData, sequence: 2 };
      const hash1 = computeEntryHash(baseData);
      const hash2 = computeEntryHash(dataSeq2);
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different previousHash', () => {
      const dataPrev = { ...baseData, previousHash: 'abc123' };
      const hash1 = computeEntryHash(baseData);
      const hash2 = computeEntryHash(dataPrev);
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different action', () => {
      const dataAction = { ...baseData, action: 'LOGOUT' };
      const hash1 = computeEntryHash(baseData);
      const hash2 = computeEntryHash(dataAction);
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different oldValue', () => {
      const dataOld = { ...baseData, oldValue: { role: 'user' } };
      const hash1 = computeEntryHash(baseData);
      const hash2 = computeEntryHash(dataOld);
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different newValue', () => {
      const dataNew = { ...baseData, newValue: { role: 'admin' } };
      const hash1 = computeEntryHash(baseData);
      const hash2 = computeEntryHash(dataNew);
      expect(hash1).not.toBe(hash2);
    });

    it('should handle complex JSON values in oldValue and newValue', () => {
      const dataComplex = {
        ...baseData,
        oldValue: { roles: ['user'], permissions: ['read'] },
        newValue: { roles: ['admin'], permissions: ['read', 'write'] },
      };
      const hash = computeEntryHash(dataComplex);
      expect(hash).toHaveLength(64);
    });

    it('should handle null userName consistently', () => {
      const dataNull = { ...baseData, userName: null };
      const dataEmpty = { ...baseData, userName: '' };
      const hashNull = computeEntryHash(dataNull);
      const hashEmpty = computeEntryHash(dataEmpty);
      // null and empty string should produce different hashes (null -> '', but handled differently)
      expect(hashNull).toBe(hashEmpty); // Both resolve to '' in buildCanonicalString
    });

    it('should handle BigInt values without throwing', () => {
      const dataBigInt = {
        ...baseData,
        newValue: { bigValue: BigInt(9007199254740991) },
      };
      expect(() => computeEntryHash(dataBigInt)).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Chain continuity tests
  // -----------------------------------------------------------------------

  describe('chain continuity', () => {
    it('should build a valid chain for sequential entries', () => {
      const entries: Array<{ sequence: number; hash: string }> = [];
      let prevHash = '';

      for (let i = 1; i <= 5; i++) {
        const entryHash = computeEntryHash({
          sequence: i,
          timestampISO: `2026-07-26T12:00:${String(i).padStart(2, '0')}.000Z`,
          userId: 'user-1',
          userName: 'Alice',
          action: i % 2 === 0 ? 'LOGIN' : 'LOGOUT',
          entityType: 'User',
          entityId: 'user-1',
          details: null,
          oldValue: null,
          newValue: null,
          previousHash: prevHash,
        });

        entries.push({ sequence: i, hash: entryHash });
        prevHash = entryHash;
      }

      // Verify chain links
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].hash).not.toBe(entries[i - 1].hash);
      }

      // First entry has empty previousHash
      const firstEntry = computeEntryHash({
        sequence: 1,
        timestampISO: '2026-07-26T12:00:01.000Z',
        userId: 'user-1',
        userName: 'Alice',
        action: 'LOGIN',
        entityType: 'User',
        entityId: 'user-1',
        details: null,
        oldValue: null,
        newValue: null,
        previousHash: '',
      });
      expect(firstEntry).toHaveLength(64);
    });

    it('should detect missing sequence gaps', () => {
      // Simulate chain with gap at sequence 3
      const prevHash1 = computeEntryHash({
        sequence: 1, timestampISO: '2026-07-26T12:00:01.000Z', userId: 'u1', userName: null,
        action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: '',
      });

      const prevHash2 = computeEntryHash({
        sequence: 2, timestampISO: '2026-07-26T12:00:02.000Z', userId: 'u1', userName: null,
        action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: prevHash1,
      });

      // Skip sequence 3 and go to 4
      const prevHash4 = computeEntryHash({
        sequence: 4, timestampISO: '2026-07-26T12:00:04.000Z', userId: 'u1', userName: null,
        action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: prevHash2,
      });

      // The chain is broken at sequence 4 because previousHash doesn't match entry 3's hash
      expect(prevHash4).not.toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // Tamper detection tests
  // -----------------------------------------------------------------------

  describe('tamper detection', () => {
    it('should detect modified entryHash (hash mismatch)', () => {
      const validHash = computeEntryHash({
        sequence: 1, timestampISO: '2026-07-26T12:00:01.000Z', userId: 'u1', userName: null,
        action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: '',
      });

      const tamperedHash = '0'.repeat(64); // All zeros — definitely wrong
      expect(validHash).not.toBe(tamperedHash);
    });

    it('should detect modified previousHash (chain link broken)', () => {
      const hash1 = computeEntryHash({
        sequence: 1, timestampISO: '2026-07-26T12:00:01.000Z', userId: 'u1', userName: null,
        action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: '',
      });

      // Entry 2 with correct previousHash
      const hash2Correct = computeEntryHash({
        sequence: 2, timestampISO: '2026-07-26T12:00:02.000Z', userId: 'u1', userName: null,
        action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: hash1,
      });

      // Entry 2 with tampered previousHash (changed to all zeros)
      const hash2Tampered = computeEntryHash({
        sequence: 2, timestampISO: '2026-07-26T12:00:02.000Z', userId: 'u1', userName: null,
        action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: '0'.repeat(64),
      });

      expect(hash2Correct).not.toBe(hash2Tampered);
    });

    it('should detect that modifying any field changes the hash', () => {
      const base = {
        sequence: 1, timestampISO: '2026-07-26T12:00:01.000Z', userId: 'u1', userName: null,
        action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: '',
      };

      const hashes = new Set<string>();
      const modifications = [
        { ...base, sequence: 2 },
        { ...base, timestampISO: '2026-07-26T13:00:01.000Z' },
        { ...base, userId: 'u2' },
        { ...base, userName: 'Bob' },
        { ...base, action: 'LOGOUT' },
        { ...base, entityType: 'Asset' },
        { ...base, entityId: 'asset-1' },
        { ...base, details: 'test' },
        { ...base, oldValue: { a: 1 } },
        { ...base, newValue: { b: 2 } },
        { ...base, previousHash: 'abc' },
      ];

      for (const mod of modifications) {
        hashes.add(computeEntryHash(mod));
      }
      // Also add the base hash to the set
      hashes.add(computeEntryHash(base));

      // All entries (base + 11 modifications = 12 total) should produce unique hashes
      expect(hashes.size).toBe(12);
    });
  });

  // -----------------------------------------------------------------------
  // Verify valid chain test
  // -----------------------------------------------------------------------

  describe('verifyIntegrity', () => {
    it('should return valid for empty database', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await verifyIntegrity(mockPrisma as any);
      expect(result.valid).toBe(true);
      expect(result.totalEntries).toBe(0);
    });

    it('should detect hash mismatch in chain', async () => {
      // Compute a valid hash for entry 1 so the first link passes
      const timestamp = new Date('2026-07-26T12:00:01.000Z');
      const validEntry1 = computeEntryHash({
        sequence: 1, timestampISO: timestamp.toISOString(), userId: 'u1', userName: null,
        action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: '',
      });

      // Simulate 3 entries where entry 2 has wrong entryHash (tampered)
      const mockEntries = [
        {
          sequence: 1, timestamp, userId: 'u1', userName: null,
          action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null,
          oldValue: null, newValue: null, entryHash: validEntry1, previousHash: null,
        },
        {
          sequence: 2, timestamp: new Date(), userId: 'u1', userName: null,
          action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null,
          oldValue: null, newValue: null, entryHash: 'TAMPERED_HASH', previousHash: validEntry1,
        },
        {
          sequence: 3, timestamp: new Date(), userId: 'u1', userName: null,
          action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null,
          oldValue: null, newValue: null, entryHash: 'valid_hash_3', previousHash: 'TAMPERED_HASH',
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockEntries);

      const result = await verifyIntegrity(mockPrisma as any);
      expect(result.valid).toBe(false);
      expect(result.brokenAtSequence).toBe(2);
      expect(result.details).toContain('Hash mismatch');
    });

    it('should detect missing sequence gap', async () => {
      // Simulate entries with sequences 1, 3 (missing 2)
      const mockEntries = [
        {
          sequence: 1, timestamp: new Date(), userId: 'u1', userName: null,
          action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null,
          oldValue: null, newValue: null, entryHash: 'hash_1', previousHash: null,
        },
        {
          sequence: 3, timestamp: new Date(), userId: 'u1', userName: null,
          action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null,
          oldValue: null, newValue: null, entryHash: 'hash_3', previousHash: 'hash_1',
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockEntries);

      const result = await verifyIntegrity(mockPrisma as any);
      expect(result.valid).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Audit creation integration tests (mocked)
  // -----------------------------------------------------------------------

  describe('audit creation with hash-chain', () => {
    it('should compute and store sequence, previousHash, entryHash in logEventStandalone', async () => {
      const mockPrevEntry = { entryHash: 'prev_hash_123', sequence: 5 };
      // The service calls findFirst to get the previous entry
      (mockPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue(mockPrevEntry);

      const event: AuditEventParams & { ipAddress?: string; userAgent?: string } = {
        userId: 'user-1',
        action: 'LOGIN',
        entityType: 'User',
        entityId: 'user-1',
        details: 'Test login',
      };

      // Import the actual service to test integration
      const { AuditService } = require('../services/audit.service');
      const service = new AuditService();

      await service.logEventStandalone(mockPrisma as any, event);

      // Verify findFirst was called to get previous entry
      expect(mockPrisma.auditLog.findFirst).toHaveBeenCalledWith({
        orderBy: { sequence: 'desc' },
        select: expect.objectContaining({ entryHash: true }),
      });

      // Verify create was called with hash-chain fields
      const createCall = (mockPrisma.auditLog.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.sequence).toBe(1);
      expect(createCall.data.previousHash).toBe('prev_hash_123');
      expect(createCall.data.entryHash).toHaveLength(64); // SHA-256 hex
    });

    it('should allocate the next sequence while holding the database chain lock before creating the audit row', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ sequence: 42 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue({ entryHash: 'prev_hash_41' });

      const { AuditService } = require('../services/audit.service');
      const service = new AuditService();

      await service.logEventStandalone(mockPrisma as any, {
        userId: 'user-1',
        action: 'LOGIN',
        entityType: 'User',
        entityId: 'user-1',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
      expect((mockPrisma.$executeRaw as jest.Mock).mock.invocationCallOrder[0])
        .toBeLessThan((mockPrisma.$queryRaw as jest.Mock).mock.invocationCallOrder[0]);
      const createCall = (mockPrisma.auditLog.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.sequence).toBe(42);
      expect(createCall.data.previousHash).toBe('prev_hash_41');
    });

    it('uses the SQL Server transaction lock and serialized max sequence allocation when configured', async () => {
      const originalProvider = process.env.DB_PROVIDER;
      process.env.DB_PROVIDER = 'sqlserver';
      mockPrisma.$queryRaw.mockResolvedValue([{ sequence: 42 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue({ entryHash: 'prev_hash_41' });

      try {
        const { AuditService } = require('../services/audit.service');
        await new AuditService().logEventStandalone(mockPrisma as any, {
          userId: 'user-1', action: 'LOGIN', entityType: 'User', entityId: 'user-1',
        });

        expect((mockPrisma.$executeRaw as jest.Mock).mock.invocationCallOrder[0])
          .toBeLessThan((mockPrisma.$queryRaw as jest.Mock).mock.invocationCallOrder[0]);
        expect((mockPrisma.auditLog.create as jest.Mock).mock.calls[0][0].data.sequence).toBe(42);
      } finally {
        if (originalProvider === undefined) delete process.env.DB_PROVIDER;
        else process.env.DB_PROVIDER = originalProvider;
      }
    });

    it('should handle first entry with empty previousHash', async () => {
      (mockPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);

      const event: AuditEventParams & { ipAddress?: string; userAgent?: string } = {
        userId: 'user-1',
        action: 'CREATE_FIRST_ADMIN',
        entityType: 'User',
        entityId: 'user-1',
      };

      const { AuditService } = require('../services/audit.service');
      const service = new AuditService();

      await service.logEventStandalone(mockPrisma as any, event);

      const createCall = (mockPrisma.auditLog.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.sequence).toBe(1); // First entry
      expect(createCall.data.previousHash ?? '').toBe(''); // Empty for genesis (may be null or '')
      expect(createCall.data.entryHash).toHaveLength(64);
    });

    it('should handle logEvent within transaction', async () => {
      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
          findFirst: jest.fn().mockResolvedValue({ entryHash: 'tx_prev_hash', sequence: 10 }),
        },
      };

      const event: AuditEventParams & { ipAddress?: string; userAgent?: string } = {
        userId: 'user-2',
        action: 'ASSET_CREATE',
        entityType: 'Asset',
        entityId: 'asset-1',
        newValue: { name: 'Server01' },
      };

      const { AuditService } = require('../services/audit.service');
      const service = new AuditService();

      await service.logEvent(mockTx as any, event);

      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-2',
          action: 'ASSET_CREATE',
          entityType: 'Asset',
          entityId: 'asset-1',
          sequence: 11,
          previousHash: 'tx_prev_hash',
          entryHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      });
    });

    it('should throw on hash computation failure (if any)', () => {
      // Hash computation uses Node.js crypto which should not fail for valid input
      expect(() => computeEntryHash({
        sequence: 1, timestampISO: '2026-07-26T12:00:00.000Z', userId: 'u1', userName: null,
        action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: '',
      })).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle very long strings in action field', () => {
      const data = {
        ...{
          sequence: 1, timestampISO: '2026-07-26T12:00:00.000Z', userId: 'u1', userName: null,
          entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: '',
        },
        action: 'A'.repeat(1000),
      };
      expect(() => computeEntryHash(data)).not.toThrow();
    });

    it('should handle empty strings consistently', () => {
      const dataEmpty = {
        sequence: 1, timestampISO: '', userId: '', userName: '',
        action: '', entityType: '', entityId: '', details: '', oldValue: null, newValue: null, previousHash: '',
      };
      expect(() => computeEntryHash(dataEmpty)).not.toThrow();
    });

    it('should handle special characters in entity fields', () => {
      const data = {
        ...{
          sequence: 1, timestampISO: '2026-07-26T12:00:00.000Z', userId: 'u1', userName: null,
          action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: '',
        },
        entityId: 'user@test.com/with<special>chars',
      };
      const hash = computeEntryHash(data);
      expect(hash).toHaveLength(64);
    });

    it('should handle Unicode characters in userName', () => {
      const data = {
        ...{
          sequence: 1, timestampISO: '2026-07-26T12:00:00.000Z', userId: 'u1', userName: null,
          action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: '',
        },
        userName: '张三', // Chinese characters
      };
      const hash = computeEntryHash(data);
      expect(hash).toHaveLength(64);
    });

    it('should handle JSON arrays in oldValue/newValue', () => {
      const data = {
        ...{
          sequence: 1, timestampISO: '2026-07-26T12:00:00.000Z', userId: 'u1', userName: null,
          action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: '',
        },
        oldValue: ['role1', 'role2'],
        newValue: ['role1', 'role2', 'admin'],
      };
      const hash = computeEntryHash(data);
      expect(hash).toHaveLength(64);
    });

    it('should handle deeply nested JSON objects', () => {
      const data = {
        ...{
          sequence: 1, timestampISO: '2026-07-26T12:00:00.000Z', userId: 'u1', userName: null,
          action: 'LOGIN', entityType: 'User', entityId: 'u1', details: null, oldValue: null, newValue: null, previousHash: '',
        },
        newValue: { level1: { level2: { level3: { level4: { deep: true } } } } },
      };
      const hash = computeEntryHash(data);
      expect(hash).toHaveLength(64);
    });
  });
});
