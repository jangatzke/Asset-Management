import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import {
  ISO27001_ANNEX_A_2022_CATALOG_CODE,
  ISO27001_ANNEX_A_2022_CONTROLS,
  ISO27001_ANNEX_A_2022_VERSION,
} from '../data/iso27001AnnexA2022';
import {
  NIS2_ARTICLES,
  NIS2_ARTICLES_CATALOG_CODE,
  NIS2_ARTICLES_CATALOG_ID,
  NIS2_ARTICLES_CATALOG_VERSION,
} from '../data/nis2UmsuCGArticles';

const ISO27001_ANNEX_A_2022_CATALOG_ID = '00000000-0000-4000-8000-000000000001';

export interface CreateCatalogData {
  name: string;
  description?: string;
  version?: string;
  url?: string;
}

export interface CreateCatalogItemData {
  catalogId: string;
  controlId: string;
  title: string;
  description?: string;
  controlText?: string;
  category?: string;
  subcategory?: string;
  sortOrder?: number;
  tags?: string[];
}

export interface ListCatalogsQuery {
  page?: string;
  limit?: string;
  search?: string;
  isActive?: string;
}

export interface ListCatalogItemsQuery {
  catalogId?: string;
  controlId?: string;
  category?: string;
  page?: string;
  limit?: string;
  search?: string;
}

export interface CatalogOption {
  id: string;
  name: string;
  version?: string;
  itemCount: number;
}

export class CatalogService {
  /**
   * Maintains the complete ISO/IEC 27001:2022 Annex A reference catalogue.
   *
   * The entries intentionally contain identifiers, titles, themes and original
   * short objectives instead of reproducing licensed ISO standard text.
   */
  async ensureIso27001AnnexA2022Catalog() {
    return prisma.$transaction(async (tx) => {
      const catalog = await tx.controlCatalog.upsert({
        where: { id: ISO27001_ANNEX_A_2022_CATALOG_ID },
        create: {
          id: ISO27001_ANNEX_A_2022_CATALOG_ID,
          name: 'ISO/IEC 27001:2022 Annex A',
          description: 'Complete ISO/IEC 27001:2022 Annex A reference catalogue with 93 control identifiers and implementation objectives.',
          version: ISO27001_ANNEX_A_2022_VERSION,
          url: 'https://www.iso.org/standard/27001.html',
          isActive: true,
        },
        update: {
          name: 'ISO/IEC 27001:2022 Annex A',
          description: 'Complete ISO/IEC 27001:2022 Annex A reference catalogue with 93 control identifiers and implementation objectives.',
          version: ISO27001_ANNEX_A_2022_VERSION,
          url: 'https://www.iso.org/standard/27001.html',
          isActive: true,
        },
      });

      for (const [index, control] of ISO27001_ANNEX_A_2022_CONTROLS.entries()) {
        await tx.controlCatalogItem.upsert({
          where: {
            catalogId_controlId: {
              catalogId: catalog.id,
              controlId: control.controlId,
            },
          },
          create: {
            catalogId: catalog.id,
            controlId: control.controlId,
            title: control.title,
            description: control.objective,
            category: control.category,
            subcategory: control.controlId.split('.')[1],
            sortOrder: index + 1,
            tags: [ISO27001_ANNEX_A_2022_CATALOG_CODE, control.category.toLowerCase()],
          },
          update: {
            title: control.title,
            description: control.objective,
            category: control.category,
            subcategory: control.controlId.split('.')[1],
            sortOrder: index + 1,
            tags: [ISO27001_ANNEX_A_2022_CATALOG_CODE, control.category.toLowerCase()],
          },
        });
      }

      return tx.controlCatalog.findUniqueOrThrow({
        where: { id: catalog.id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  /**
   * Maintains the NIS2-Umsetzungsgesetz (NIS2UmsuCG) obligation catalogue.
   *
   * Stores each obligation Article (23, 24, 25, 26, 27, 29, 30) as a
   * `ControlCatalogItem`. The Article's `crosswalk` field carries the list of
   * ISO/IEC 27001:2022 Annex A controls that fulfil the Article so the frontend
   * can render a crosswalk (which ISO controls satisfy which NIS2 obligation).
   *
   * The catalogue uses a fixed, deterministic id so it can be referenced from
   * the frontend and tests without a lookup.
   */
  async ensureNis2UmsuCGCatalog() {
    return prisma.$transaction(async (tx) => {
      const catalog = await tx.controlCatalog.upsert({
        where: { id: NIS2_ARTICLES_CATALOG_ID },
        create: {
          id: NIS2_ARTICLES_CATALOG_ID,
          name: 'NIS2-Umsetzungsgesetz (Obligation Articles)',
          description:
            'Obligation Articles of the NIS2-Umsetzungsgesetz (Art. 23–30) with crosswalk to ISO/IEC 27001:2022 Annex A controls.',
          version: NIS2_ARTICLES_CATALOG_VERSION,
          isActive: true,
        },
        update: {
          name: 'NIS2-Umsetzungsgesetz (Obligation Articles)',
          description:
            'Obligation Articles of the NIS2-Umsetzungsgesetz (Art. 23–30) with crosswalk to ISO/IEC 27001:2022 Annex A controls.',
          version: NIS2_ARTICLES_CATALOG_VERSION,
          isActive: true,
        },
      });

      for (const [index, article] of NIS2_ARTICLES.entries()) {
        await tx.controlCatalogItem.upsert({
          where: {
            catalogId_controlId: {
              catalogId: catalog.id,
              controlId: `Article-${article.articleId}`,
            },
          },
          create: {
            catalogId: catalog.id,
            controlId: `Article-${article.articleId}`,
            title: `${article.article} ${article.titleEn}`,
            description: `${article.descriptionEn}\n\n${article.descriptionDe}`,
            category: 'NIS2UmsuCG',
            subcategory: article.article,
            sortOrder: index + 1,
            tags: [NIS2_ARTICLES_CATALOG_CODE, 'obligation'],
            crosswalk: article.isoCrosswalk,
          },
          update: {
            title: `${article.article} ${article.titleEn}`,
            description: `${article.descriptionEn}\n\n${article.descriptionDe}`,
            category: 'NIS2UmsuCG',
            subcategory: article.article,
            sortOrder: index + 1,
            tags: [NIS2_ARTICLES_CATALOG_CODE, 'obligation'],
            crosswalk: article.isoCrosswalk,
          },
        });
      }

      return tx.controlCatalog.findUniqueOrThrow({
        where: { id: catalog.id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  /**
   * Returns the NIS2 obligation catalogue together with its crosswalk data.
   *
   * If the catalogue has not been seeded yet (e.g. on a fresh database that was
   * not run through the seed script) it is created first and then returned.
   */
  async getNis2ObligationCatalog(): Promise<Prisma.ControlCatalogGetPayload<{ include: { items: { orderBy: { sortOrder: 'asc' } } } }> | null> {
    const existing = await prisma.controlCatalog.findUnique({
      where: { id: NIS2_ARTICLES_CATALOG_ID },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (existing) {
      return existing;
    }

    return this.ensureNis2UmsuCGCatalog();
  }

  async listCatalogs(query: ListCatalogsQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.ControlCatalogWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    const [catalogs, total] = await Promise.all([
      prisma.controlCatalog.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.controlCatalog.count({ where }),
    ]);

    return {
      data: catalogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCatalog(id: string) {
    const catalog = await prisma.controlCatalog.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' as const } } },
    });

    if (!catalog) {
      throw new AppError('Catalog not found', 404);
    }

    return catalog;
  }

  async createCatalog(data: CreateCatalogData) {
    const catalog = await prisma.controlCatalog.create({
      data,
    });

    return catalog;
  }

  async updateCatalog(id: string, data: Partial<CreateCatalogData>) {
    const existing = await prisma.controlCatalog.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Catalog not found', 404);
    }

    const catalog = await prisma.controlCatalog.update({
      where: { id },
      data,
    });

    return catalog;
  }

  async deleteCatalog(id: string) {
    await prisma.controlCatalog.delete({ where: { id } });
  }

  async listCatalogItems(query: ListCatalogItemsQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.ControlCatalogItemWhereInput = {};

    if (query.catalogId) {
      where.catalogId = query.catalogId;
    }

    if (query.controlId) {
      where.controlId = query.controlId;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.controlCatalogItem.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { sortOrder: 'asc' as const },
        include: { catalog: true },
      }),
      prisma.controlCatalogItem.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCatalogItem(catalogId: string, controlId: string) {
    const item = await prisma.controlCatalogItem.findUnique({
      where: {
        catalogId_controlId: {
          catalogId,
          controlId,
        },
      },
      include: { catalog: true },
    });

    if (!item) {
      throw new AppError('Catalog item not found', 404);
    }

    return item;
  }

  async createCatalogItem(data: CreateCatalogItemData) {
    const item = await prisma.controlCatalogItem.create({
      data,
    });

    return item;
  }

  async updateCatalogItem(catalogId: string, controlId: string, data: Partial<CreateCatalogItemData>) {
    const item = await prisma.controlCatalogItem.update({
      where: {
        catalogId_controlId: {
          catalogId,
          controlId,
        },
      },
      data,
    });

    return item;
  }

  async deleteCatalogItem(catalogId: string, controlId: string) {
    await prisma.controlCatalogItem.delete({
      where: {
        catalogId_controlId: {
          catalogId,
          controlId,
        },
      },
    });
  }

  async getCatalogsForControl(controlId: string) {
    const items = await prisma.controlCatalogItem.findMany({
      where: { controlId },
      include: { catalog: true },
      orderBy: { sortOrder: 'asc' as const },
    });

    return items;
  }

  async getCatalogOptions(): Promise<{ id: string; name: string; version?: string; itemCount: number }[]> {
    const catalogs = await prisma.controlCatalog.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    // Get item counts separately
    const itemCounts = await prisma.controlCatalogItem.groupBy({
      by: 'catalogId',
      _count: {
        _all: true,
      },
    });

    const countMap = new Map<string, number>();
    for (const item of itemCounts) {
      countMap.set(item.catalogId, item._count._all);
    }

    return catalogs.map(c => ({
      id: c.id,
      name: c.name,
      version: c.version ?? undefined,
      itemCount: countMap.get(c.id) || 0,
    }));
  }
}

export const catalogService = new CatalogService();
