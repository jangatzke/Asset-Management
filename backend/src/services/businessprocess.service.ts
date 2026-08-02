import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { recordCreateHistory, recordUpdateHistory, recordDeleteHistory, toHistoryData } from './entityHistory.service';

export interface CreateBusinessProcessData {
  name: string;
  description?: string | null;
  processOwner: string;
  category?: string | null;
  siacControlled?: boolean;
  criticality?: string;
  status?: string;
}

export interface UpdateBusinessProcessData extends Partial<CreateBusinessProcessData> {}

export interface ListBusinessProcessesQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  category?: string;
  criticality?: string;
  processOwner?: string;
}

export class BusinessProcessService {
  async list(query: ListBusinessProcessesQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.BusinessProcessWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.criticality) {
      where.criticality = query.criticality;
    }

    if (query.processOwner) {
      where.processOwner = query.processOwner;
    }

    const [processes, total] = await Promise.all([
      prisma.businessProcess.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.businessProcess.count({ where }),
    ]);

    return {
      data: processes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const process = await prisma.businessProcess.findUnique({
      where: { id },
      include: {
        risks: {
          where: { isArchived: false },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!process) {
      throw new AppError('Business process not found', 404);
    }

    return process;
  }

  async create(data: CreateBusinessProcessData, createdBy?: string) {
    const displayId = `BP-${Date.now()}`;

    const process = await prisma.businessProcess.create({
      data: {
        ...data,
        displayId,
        createdBy,
      },
    });

    // Record entity history
    await recordCreateHistory({
      entityType: 'Process',
      entityId: process.id,
      data: { name: data.name },
      actorId: createdBy,
    });

    return process;
  }

  async update(id: string, data: UpdateBusinessProcessData, updatedBy?: string) {
    const existing = await prisma.businessProcess.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Business process not found', 404);
    }

    const process = await prisma.businessProcess.update({
      where: { id },
      data: { ...data, updatedBy },
    });

    // Record entity history for update (status-like field is status)
    await recordUpdateHistory({
      entityType: 'Process',
      entityId: id,
      oldData: toHistoryData(existing as any),
      newData: toHistoryData(process as any),
      statusField: 'status',
      actorId: updatedBy,
    });

    return process;
  }

  async delete(id: string, deletedBy?: string) {
    const existing = await prisma.businessProcess.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Business process not found', 404);
    }

    await prisma.businessProcess.update({
      where: { id },
      data: { isArchived: true },
    });

    // Record entity history for delete (archive)
    await recordDeleteHistory({
      entityType: 'Process',
      entityId: id,
      actorId: deletedBy,
    });

    return { success: true };
  }

  async getRisks(processId: string) {
    const process = await prisma.businessProcess.findUnique({ where: { id: processId } });
    if (!process) {
      throw new AppError('Business process not found', 404);
    }

    return prisma.risk.findMany({
      where: { businessProcessId: processId, isArchived: false },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const businessProcessService = new BusinessProcessService();
