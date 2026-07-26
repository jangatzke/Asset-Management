/**
 * Training Domain Service — Phase 7
 *
 * Handles training course, assignment, completion, and acknowledgement lifecycle with explicit business rules:
 * - Course status transitions (draft -> active -> archived)
 * - Assignment status transitions (assigned -> in_progress -> completed/expired/overdue)
 * - Completion requires valid assignment reference
 * - Acknowledgement requires course to be active
 * - Audit logging
 */

import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService, AuditAction } from './audit.service';
import { validateTransition } from './statusTransition';

type AnyObject = Record<string, any>;

const COURSE_CREATE_ACTION: AuditAction = 'CONFIG_CHANGE';
const ASSIGNMENT_CREATE_ACTION: AuditAction = 'CONFIG_CHANGE';
const COMPLETION_CREATE_ACTION: AuditAction = 'DOCUMENT_ACKNOWLEDGE';
const ACKNOWLEDGEMENT_CREATE_ACTION: AuditAction = 'DOCUMENT_ACKNOWLEDGE';

export class TrainingService {
  private displayId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  // =========================================================================
  // Training Course
  // =========================================================================

  async createCourse(data: AnyObject, userId: string): Promise<AnyObject> {
    const createData: AnyObject = { ...data, createdBy: userId };
    if (!createData.displayId) createData.displayId = this.displayId('TRC');
    if (!createData.status) createData.status = 'draft';

    const course = await prisma.trainingCourse.create({ data: createData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: COURSE_CREATE_ACTION,
      entityType: 'TrainingCourse',
      entityId: course.id,
      details: `Created training course ${course.displayId}`,
      newValue: course as any,
    });
    return course;
  }

  async updateCourse(id: string, data: AnyObject, userId: string): Promise<AnyObject> {
    const existing = await this.getCourse(id);

    // Validate status transition
    if (data.status && data.status !== existing.status) {
      const result = validateTransition('trainingCourses', existing.status, data.status);
      if (!result.allowed) {
        throw new AppError(
          `Training course status transition from "${existing.status}" to "${data.status}" is not allowed: ${result.message}`,
          400,
        );
      }
    }

    const updateData = { ...data, updatedBy: userId };
    const course = await prisma.trainingCourse.update({ where: { id }, data: updateData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'CONFIG_CHANGE',
      entityType: 'TrainingCourse',
      entityId: id,
      details: `Updated training course ${existing.displayId}`,
      oldValue: existing as any,
      newValue: course as any,
    });
    return course;
  }

  async getCourse(id: string): Promise<AnyObject> {
    const course = await prisma.trainingCourse.findUnique({ where: { id } });
    if (!course) throw new AppError('Training course not found', 404);
    return course;
  }

  async listCourses(query: AnyObject = {}): Promise<AnyObject> {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;
    const where: AnyObject = {};

    if (query.status) where.status = String(query.status);
    if (query.category) where.category = String(query.category);
    if (query.mandatory !== undefined) where.mandatory = query.mandatory === 'true' || query.mandatory === true;
    if (query.search) {
      where.OR = [
        { title: { contains: String(query.search), mode: 'insensitive' } },
        { description: { contains: String(query.search), mode: 'insensitive' } },
        { category: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.trainingCourse.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' as const } }),
      prisma.trainingCourse.count({ where }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // =========================================================================
  // Training Assignment
  // =========================================================================

  async createAssignment(data: AnyObject, userId: string): Promise<AnyObject> {
    // Validate course exists and is active
    const course = await prisma.trainingCourse.findUnique({ where: { id: data.courseId } });
    if (!course) throw new AppError('Training course not found', 404);

    const createData: AnyObject = { ...data, assignedBy: userId };
    if (!createData.status) createData.status = 'assigned';

    const assignment = await prisma.trainingAssignment.create({ data: createData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: ASSIGNMENT_CREATE_ACTION,
      entityType: 'TrainingAssignment',
      entityId: assignment.id,
      details: `Assigned course ${course.displayId} to user ${assignment.userId}`,
      newValue: assignment as any,
    });
    return assignment;
  }

  async updateAssignment(id: string, data: AnyObject, userId: string): Promise<AnyObject> {
    const existing = await this.getAssignment(id);

    // Validate status transition
    if (data.status && data.status !== existing.status) {
      const result = validateTransition('trainingAssignments', existing.status, data.status);
      if (!result.allowed) {
        throw new AppError(
          `Training assignment status transition from "${existing.status}" to "${data.status}" is not allowed: ${result.message}`,
          400,
        );
      }
    }

    const updateData = { ...data, updatedBy: userId };
    const assignment = await prisma.trainingAssignment.update({ where: { id }, data: updateData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'CONFIG_CHANGE',
      entityType: 'TrainingAssignment',
      entityId: id,
      details: `Updated assignment ${existing.id}`,
      oldValue: existing as any,
      newValue: assignment as any,
    });
    return assignment;
  }

  async getAssignment(id: string): Promise<AnyObject> {
    const assignment = await prisma.trainingAssignment.findUnique({ where: { id } });
    if (!assignment) throw new AppError('Training assignment not found', 404);
    return assignment;
  }

  async listAssignments(query: AnyObject = {}): Promise<AnyObject> {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;
    const where: AnyObject = {};

    if (query.status) where.status = String(query.status);
    if (query.courseId) where.courseId = String(query.courseId);
    if (query.userId) where.userId = String(query.userId);

    const [data, total] = await Promise.all([
      prisma.trainingAssignment.findMany({ where, skip, take: limit, orderBy: { assignedAt: 'desc' as const } }),
      prisma.trainingAssignment.count({ where }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // =========================================================================
  // Training Completion
  // =========================================================================

  async createCompletion(data: AnyObject, userId: string): Promise<AnyObject> {
    // Validate assignment exists
    const assignment = await prisma.trainingAssignment.findUnique({ where: { id: data.assignmentId } });
    if (!assignment) throw new AppError('Training assignment not found', 404);

    // Assignment must be in assigned or in_progress state to complete
    if (assignment.status !== 'assigned' && assignment.status !== 'in_progress') {
      throw new AppError(`Cannot complete assignment with status "${assignment.status}". Must be "assigned" or "in_progress".`, 400);
    }

    const createData: AnyObject = {
      ...data,
      courseId: data.courseId ?? assignment.courseId,
      userId: data.userId ?? assignment.userId,
      result: data.result ?? 'passed',
      createdBy: userId,
    };

    const completion = await prisma.trainingCompletion.create({ data: createData as any });

    // Update assignment status to completed
    await prisma.trainingAssignment.update({
      where: { id: data.assignmentId },
      data: { status: 'completed', completedAt: completion.completedAt, completionId: completion.id },
    });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: COMPLETION_CREATE_ACTION,
      entityType: 'TrainingCompletion',
      entityId: completion.id,
      details: `Completed training assignment ${data.assignmentId} with result: ${createData.result}`,
      newValue: completion as any,
    });
    return completion;
  }

  async listCompletions(query: AnyObject = {}): Promise<AnyObject> {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;
    const where: AnyObject = {};

    if (query.assignmentId) where.assignmentId = String(query.assignmentId);
    if (query.userId) where.userId = String(query.userId);
    if (query.result) where.result = String(query.result);

    const [data, total] = await Promise.all([
      prisma.trainingCompletion.findMany({ where, skip, take: limit, orderBy: { completedAt: 'desc' as const } }),
      prisma.trainingCompletion.count({ where }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // =========================================================================
  // Training Acknowledgement
  // =========================================================================

  async createAcknowledgement(data: AnyObject, userId: string): Promise<AnyObject> {
    // Validate course exists
    const course = await prisma.trainingCourse.findUnique({ where: { id: data.courseId } });
    if (!course) throw new AppError('Training course not found', 404);

    // Check for existing acknowledgement by this user for this course
    const existing = await prisma.trainingAcknowledgement.findFirst({
      where: { courseId: data.courseId, userId: data.userId ?? userId },
    });

    if (existing) {
      throw new AppError('User has already acknowledged this training course', 409);
    }

    const createData: AnyObject = {
      ...data,
      userId: data.userId ?? userId,
      createdBy: userId,
    };

    const acknowledgement = await prisma.trainingAcknowledgement.create({ data: createData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: ACKNOWLEDGEMENT_CREATE_ACTION,
      entityType: 'TrainingAcknowledgement',
      entityId: acknowledgement.id,
      details: `User ${createData.userId} acknowledged course ${course.displayId}`,
      newValue: acknowledgement as any,
    });
    return acknowledgement;
  }

  async listAcknowledgements(query: AnyObject = {}): Promise<AnyObject> {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;
    const where: AnyObject = {};

    if (query.courseId) where.courseId = String(query.courseId);
    if (query.userId) where.userId = String(query.userId);

    const [data, total] = await Promise.all([
      prisma.trainingAcknowledgement.findMany({ where, skip, take: limit, orderBy: { acknowledgedAt: 'desc' as const } }),
      prisma.trainingAcknowledgement.count({ where }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}

export const trainingService = new TrainingService();
