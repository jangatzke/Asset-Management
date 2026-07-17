import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface CreateControlData {
  catalogId: string;
  catalogVersion: string;
  title: string;
  description: string;
  controlGoal: string;
  responsibleId?: string;
  applicability?: string;
  applicabilityJustification?: string;
  implementationStatus?: string;
  maturityLevel?: number;
  implementationDescription?: string;
  affectedAssetIds?: string[];
  affectedProcessIds?: string[];
  affectedSiteIds?: string[];
  relatedRiskIds?: string[];
  evidenceIds?: string[];
  testMethod?: string;
  testFrequency?: string;
}

export interface UpdateControlData extends Partial<CreateControlData> {
  status?: string;
}

export interface ListControlsQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  implementationStatus?: string;
  catalogId?: string;
}

export class ControlService {
  async list(query: ListControlsQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.ControlWhereInput = {};

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.implementationStatus) {
      where.implementationStatus = query.implementationStatus;
    }

    if (query.catalogId) {
      where.catalogId = query.catalogId;
    }

    const [controls, total] = await Promise.all([
      prisma.control.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.control.count({ where }),
    ]);

    return {
      data: controls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const control = await prisma.control.findUnique({
      where: { id },
    });

    if (!control) {
      throw new AppError('Control not found', 404);
    }

    return control;
  }

  async create(data: CreateControlData, createdBy?: string) {
    const control = await prisma.control.create({
      data: {
        ...data,
        createdBy,
      },
    });

    return control;
  }

  async update(id: string, data: UpdateControlData, updatedBy?: string) {
    const existing = await prisma.control.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Control not found', 404);
    }

    const control = await prisma.control.update({
      where: { id },
      data: {
        ...data,
        updatedBy,
      },
    });

    return control;
  }

  async delete(id: string) {
    const existing = await prisma.control.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Control not found', 404);
    }

    await prisma.control.update({
      where: { id },
      data: { isArchived: true },
    });

    return { success: true };
  }

  async getSOA(scopeId?: string) {
    const where: Prisma.StatementOfApplicabilityWhereInput = {};
    if (scopeId) {
      where.scopeId = scopeId;
    }

    return prisma.statementOfApplicability.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSOA(data: {
    frameworkId: string;
    frameworkVersion: string;
    scopeId: string;
    controls: any;
  }) {
    const soa = await prisma.statementOfApplicability.create({
      data: {
        ...data,
        controls: data.controls,
      },
    });

    return soa;
  }
}

export const controlService = new ControlService();