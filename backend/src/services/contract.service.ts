import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface CreateContractData {
  title: string;
  description?: string;
  contractType: string;
  supplierId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  renewalDate?: Date | null;
  value?: number | null;
  currency?: string | null;
  status?: string;
}

export interface UpdateContractData extends Partial<CreateContractData> {}

export interface ListContractsQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  contractType?: string;
  supplierId?: string;
  startDateFrom?: string;
  startDateTo?: string;
}

export class ContractService {
  async list(query: ListContractsQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.ContractWhereInput = {};

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.contractType) {
      where.contractType = query.contractType;
    }

    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query.startDateFrom || query.startDateTo) {
      where.startDate = {};
      if (query.startDateFrom) {
        where.startDate.gte = new Date(query.startDateFrom);
      }
      if (query.startDateTo) {
        where.startDate.lte = new Date(query.startDateTo);
      }
    }

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contract.count({ where }),
    ]);

    return {
      data: contracts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { assetLinks: { include: { asset: { include: { assetType: true } } } } },
    });

    if (!contract) {
      throw new AppError('Contract not found', 404);
    }

    return contract;
  }

  async create(data: CreateContractData, createdBy?: string) {
    const displayId = `CTR-${Date.now()}`;

    const contract = await prisma.contract.create({
      data: {
        ...data,
        displayId,
        createdBy,
      },
    });

    return contract;
  }

  async update(id: string, data: UpdateContractData, updatedBy?: string) {
    const existing = await prisma.contract.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Contract not found', 404);
    }

    const contract = await prisma.contract.update({
      where: { id },
      data: { ...data, updatedBy },
    });

    return contract;
  }

  async delete(id: string) {
    const existing = await prisma.contract.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Contract not found', 404);
    }

    await prisma.contract.update({
      where: { id },
      data: { isArchived: true },
    });

    return { success: true };
  }

  async getAssets(contractId: string) {
    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) {
      throw new AppError('Contract not found', 404);
    }

    return prisma.asset.findMany({
      where: { contractLinks: { some: { contractId } } },
      include: { assetType: true },
    });
  }
}

export const contractService = new ContractService();
