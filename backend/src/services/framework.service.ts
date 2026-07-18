import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

export interface FrameworkRequirementImport {
  key: string;
  title: string;
  text: string;
  section?: string;
  clauseNumber?: string;
  parentKey?: string;
  sortOrder?: number;
  licenseNotice?: string;
}

export interface FrameworkImportData {
  framework: {
    name: string;
    code: string;
    description?: string;
    publisher?: string;
  };
  version: string;
  publicationDate?: Date;
  source?: string;
  licenseInfo?: string;
  changelog?: string;
  requirements: FrameworkRequirementImport[];
}

export class FrameworkService {
  async importFramework(data: FrameworkImportData, createdBy?: string) {
    if (!data.licenseInfo?.trim()) {
      throw new AppError('Framework import requires license information', 400);
    }
    if (!Array.isArray(data.requirements) || data.requirements.length === 0) {
      throw new AppError('Framework import requires at least one requirement', 400);
    }

    const duplicateKeys = data.requirements
      .map((requirement) => requirement.key)
      .filter((key, index, all) => all.indexOf(key) !== index);
    if (duplicateKeys.length > 0) {
      throw new AppError(`Duplicate requirement keys: ${Array.from(new Set(duplicateKeys)).join(', ')}`, 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const framework = await tx.framework.upsert({
        where: { code: data.framework.code },
        update: {
          name: data.framework.name,
          description: data.framework.description,
          publisher: data.framework.publisher,
          version: data.version,
          publicationDate: data.publicationDate,
          licenseInfo: data.licenseInfo,
          updatedBy: createdBy,
        },
        create: {
          name: data.framework.name,
          code: data.framework.code,
          description: data.framework.description,
          publisher: data.framework.publisher,
          version: data.version,
          publicationDate: data.publicationDate,
          licenseInfo: data.licenseInfo,
          createdBy,
        },
      });

      await tx.frameworkVersion.updateMany({
        where: { frameworkId: framework.id },
        data: { isActive: false },
      });

      const frameworkVersion = await tx.frameworkVersion.create({
        data: {
          frameworkId: framework.id,
          version: data.version,
          publicationDate: data.publicationDate,
          source: data.source,
          licenseInfo: data.licenseInfo,
          changelog: data.changelog,
          createdBy,
          requirements: {
            create: data.requirements.map((requirement) => ({
              requirementKey: requirement.key,
              title: requirement.title,
              requirementText: requirement.text,
              section: requirement.section,
              clauseNumber: requirement.clauseNumber,
              parentKey: requirement.parentKey,
              sortOrder: requirement.sortOrder,
              licenseNotice: requirement.licenseNotice ?? data.licenseInfo,
            })),
          },
        },
        include: { framework: true, requirements: true },
      });

      return frameworkVersion;
    });

    if (createdBy) {
      await auditService.logEventStandalone(prisma, {
        userId: createdBy,
        action: 'FRAMEWORK_IMPORT',
        entityType: 'FrameworkVersion',
        entityId: result.id,
        details: `Imported framework ${data.framework.code} ${data.version}`,
        newValue: { requirementCount: result.requirements.length, licenseInfo: data.licenseInfo },
      });
    }

    return result;
  }

  async list() {
    return prisma.framework.findMany({
      orderBy: { code: 'asc' },
      include: { versions: { orderBy: { importedAt: 'desc' }, take: 5 } },
    });
  }

  async getVersion(id: string) {
    const version = await prisma.frameworkVersion.findUnique({
      where: { id },
      include: { framework: true, requirements: { orderBy: [{ sortOrder: 'asc' }, { requirementKey: 'asc' }] } },
    });
    if (!version) throw new AppError('Framework version not found', 404);
    return version;
  }

  async compareVersions(fromVersionId: string, toVersionId: string) {
    const [fromVersion, toVersion] = await Promise.all([
      this.getVersion(fromVersionId),
      this.getVersion(toVersionId),
    ]);

    const fromByKey = new Map(fromVersion.requirements.map((requirement) => [requirement.requirementKey, requirement]));
    const toByKey = new Map(toVersion.requirements.map((requirement) => [requirement.requirementKey, requirement]));

    const added: string[] = [];
    const removed: string[] = [];
    const changed: Array<{ key: string; changes: string[] }> = [];
    const unchanged: string[] = [];

    for (const [key, toRequirement] of toByKey.entries()) {
      const fromRequirement = fromByKey.get(key);
      if (!fromRequirement) {
        added.push(key);
        continue;
      }
      const changes: string[] = [];
      if (fromRequirement.title !== toRequirement.title) changes.push('title');
      if (fromRequirement.requirementText !== toRequirement.requirementText) changes.push('text');
      if (fromRequirement.section !== toRequirement.section) changes.push('section');
      if (fromRequirement.clauseNumber !== toRequirement.clauseNumber) changes.push('clauseNumber');
      if (changes.length > 0) changed.push({ key, changes });
      else unchanged.push(key);
    }

    for (const key of fromByKey.keys()) {
      if (!toByKey.has(key)) removed.push(key);
    }

    return {
      from: { id: fromVersion.id, version: fromVersion.version, frameworkCode: fromVersion.framework.code },
      to: { id: toVersion.id, version: toVersion.version, frameworkCode: toVersion.framework.code },
      summary: { added: added.length, removed: removed.length, changed: changed.length, unchanged: unchanged.length },
      added,
      removed,
      changed,
      unchanged,
    };
  }

  async mapControlToRequirements(controlId: string, requirementIds: string[], mappingType = 'fully_fulfills', createdBy?: string) {
    const control = await prisma.control.findUnique({ where: { id: controlId } });
    if (!control) throw new AppError('Control not found', 404);
    if (requirementIds.length === 0) throw new AppError('At least one requirement is required', 400);

    const requirements = await prisma.requirement.findMany({ where: { id: { in: requirementIds } } });
    if (requirements.length !== requirementIds.length) throw new AppError('One or more requirements were not found', 400);

    await prisma.controlRequirementMapping.createMany({
      data: requirementIds.map((requirementId) => ({ controlId, requirementId, mappingType, createdBy })),
      skipDuplicates: true,
    });

    if (createdBy) {
      await auditService.logEventStandalone(prisma, {
        userId: createdBy,
        action: 'CONTROL_REQUIREMENT_MAP',
        entityType: 'Control',
        entityId: controlId,
        details: `Mapped control to ${requirementIds.length} requirements`,
        newValue: { requirementIds, mappingType },
      });
    }

    return prisma.control.findUnique({
      where: { id: controlId },
      include: { requirementMappings: { include: { requirement: true } } } as Prisma.ControlInclude,
    });
  }
}

export const frameworkService = new FrameworkService();
