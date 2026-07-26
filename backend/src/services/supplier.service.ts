/**
 * Supplier Domain Service — Phase 7
 *
 * Handles supplier and supplier assessment lifecycle with explicit business rules:
 * - Display ID generation (SUP-XXXXX format)
 * - Status transition validation via statusTransition automaton
 * - Archive cascade checks (active assessments before archiving)
 * - Audit logging with domain-specific actions
 */

import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService, AuditAction } from './audit.service';
import { validateTransition } from './statusTransition';

type AnyObject = Record<string, any>;

const CREATE_ACTION: AuditAction = 'CONFIG_CHANGE';
const UPDATE_ACTION: AuditAction = 'CONFIG_CHANGE';
const ARCHIVE_ACTION: AuditAction = 'ASSET_ARCHIVE';
const ASSESSMENT_CREATE_ACTION: AuditAction = 'CONFIG_CHANGE';

export class SupplierService {
  private displayId(): string {
    return `SUP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  /**
   * Create a new supplier with validated display ID.
   */
  async create(data: AnyObject, userId: string): Promise<AnyObject> {
    const createData: AnyObject = { ...data, createdBy: userId };
    if (!createData.displayId) {
      createData.displayId = this.displayId();
    }
    if (!createData.status) {
      createData.status = 'active';
    }

    const supplier = await prisma.supplier.create({ data: createData as any });
    await auditService.logEventStandalone(prisma, {
      userId,
      action: CREATE_ACTION,
      entityType: 'Supplier',
      entityId: supplier.id,
      details: `Created supplier ${supplier.displayId}`,
      newValue: supplier as any,
    });
    return supplier;
  }

  /**
   * Update a supplier with status transition validation.
   */
  async update(id: string, data: AnyObject, userId: string): Promise<AnyObject> {
    const existing = await this.get(id);

    // Validate status transition if status is being changed
    if (data.status && data.status !== existing.status) {
      const result = validateTransition('suppliers', existing.status, data.status);
      if (!result.allowed) {
        throw new AppError(
          `Supplier status transition from "${existing.status}" to "${data.status}" is not allowed: ${result.message}`,
          400,
        );
      }
    }

    const updateData = { ...data, updatedBy: userId };
    const supplier = await prisma.supplier.update({ where: { id }, data: updateData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: UPDATE_ACTION,
      entityType: 'Supplier',
      entityId: id,
      details: `Updated supplier ${supplier.displayId}`,
      oldValue: existing as any,
      newValue: supplier as any,
    });
    return supplier;
  }

  /**
   * Get a single supplier by ID.
   */
  async get(id: string): Promise<AnyObject> {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new AppError('Supplier not found', 404);
    return supplier;
  }

  /**
   * List suppliers with pagination and filters.
   */
  async list(query: AnyObject = {}): Promise<AnyObject> {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;
    const where: AnyObject = {};

    // Exclude archived by default unless explicitly requested
    if (query.archived !== 'true' && query.isArchived !== true) {
      where.isArchived = false;
    }

    if (query.status) where.status = String(query.status);
    if (query.criticality) where.criticality = String(query.criticality);
    if (query.search) {
      where.OR = [
        { legalName: { contains: String(query.search), mode: 'insensitive' } },
        { description: { contains: String(query.search), mode: 'insensitive' } },
        { servicesProvided: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.supplier.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' as const } }),
      prisma.supplier.count({ where }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Archive a supplier — validates no active assessments exist.
   */
  async archive(id: string, userId: string): Promise<AnyObject> {
    const existing = await this.get(id);

    if (existing.isArchived) {
      throw new AppError('Supplier is already archived', 400);
    }

    // Check for active assessments
    const activeAssessments = await prisma.supplierAssessment.count({
      where: { supplierId: id, status: { in: ['draft', 'under_review'] } },
    });

    if (activeAssessments > 0) {
      throw new AppError(
        `Cannot archive supplier with ${activeAssessments} active assessment(s). Complete or reject assessments first.`,
        400,
      );
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: { isArchived: true, status: 'archived', updatedBy: userId },
    });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: ARCHIVE_ACTION,
      entityType: 'Supplier',
      entityId: id,
      details: `Archived supplier ${existing.displayId}`,
      oldValue: existing as any,
    });
    return supplier;
  }

  /**
   * Create a supplier assessment.
   */
  async createAssessment(supplierId: string, data: AnyObject, userId: string): Promise<AnyObject> {
    // Validate supplier exists and is not archived
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new AppError('Supplier not found', 404);
    if (supplier.isArchived) throw new AppError('Cannot assess an archived supplier', 400);

    const createData: AnyObject = { ...data, supplierId, createdBy: userId };
    if (!createData.status) createData.status = 'draft';

    const assessment = await prisma.supplierAssessment.create({ data: createData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: ASSESSMENT_CREATE_ACTION,
      entityType: 'SupplierAssessment',
      entityId: assessment.id,
      details: `Created assessment for supplier ${supplier.displayId}`,
      newValue: assessment as any,
    });
    return assessment;
  }

  /**
   * Update a supplier assessment with status transition validation.
   */
  async updateAssessment(id: string, data: AnyObject, userId: string): Promise<AnyObject> {
    const existing = await prisma.supplierAssessment.findUnique({ where: { id } });
    if (!existing) throw new AppError('Supplier assessment not found', 404);

    // Validate status transition
    if (data.status && data.status !== existing.status) {
      const result = validateTransition('supplierAssessments', existing.status, data.status);
      if (!result.allowed) {
        throw new AppError(
          `Supplier assessment status transition from "${existing.status}" to "${data.status}" is not allowed: ${result.message}`,
          400,
        );
      }
    }

    const assessment = await prisma.supplierAssessment.update({ where: { id }, data });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: UPDATE_ACTION,
      entityType: 'SupplierAssessment',
      entityId: id,
      details: `Updated assessment`,
      oldValue: existing as any,
      newValue: assessment as any,
    });
    return assessment;
  }

  /**
   * List assessments for a supplier.
   */
  async listAssessments(supplierId: string, query: AnyObject = {}): Promise<AnyObject> {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new AppError('Supplier not found', 404);

    const where: AnyObject = { supplierId };
    if (query.status) where.status = String(query.status);

    const [data, total] = await Promise.all([
      prisma.supplierAssessment.findMany({ where, skip, take: limit, orderBy: { assessmentDate: 'desc' as const } }),
      prisma.supplierAssessment.count({ where }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}

export const supplierService = new SupplierService();
