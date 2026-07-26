import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { nextDisplayId } from './displayId.service';
import { fiscalYearService } from './fiscalYear.service';

const ACTIVE_ITEM_STATUSES = ['candidate', 'planned', 'approved', 'ordered', 'acquired', 'done'];
const COMMITTED_STATUSES = ['approved', 'ordered', 'acquired', 'done'];

export class CostPlanningService {
  async years() {
    return fiscalYearService.listSelectableYears();
  }

  async createOrGetPlan(fiscalYearLabel: string, userId: string, ownerUserId?: string) {
    const period = await fiscalYearService.getFiscalYearByLabel(fiscalYearLabel);
    const existing = await prisma.costPlan.findUnique({ where: { fiscalYearLabel: period.label }, include: { items: true, owner: true } });
    if (existing) return this.withSummary(existing);
    return prisma.$transaction(async (tx) => {
      const displayId = await nextDisplayId(tx, 'CostPlan');
      const plan = await tx.costPlan.create({
        data: {
          displayId,
          fiscalYearLabel: period.label,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          ownerUserId,
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        include: { items: true, owner: true },
      });
      await tx.auditLog.create({ data: { userId, action: 'COST_PLAN_CREATE', entityType: 'CostPlan', entityId: plan.id, details: `Created cost plan ${plan.displayId}` } as any });
      return this.withSummary(plan);
    });
  }

  async listPlans(params: { fiscalYearLabel?: string; status?: string }) {
    return prisma.costPlan.findMany({
      where: { fiscalYearLabel: params.fiscalYearLabel, status: params.status, isArchived: false },
      orderBy: { periodStart: 'desc' },
      include: { owner: true, items: true },
    });
  }

  async getPlan(id: string, filters: any = {}) {
    const plan = await prisma.costPlan.findUnique({
      where: { id },
      include: { owner: true, items: { where: this.itemWhere(filters), orderBy: [{ dueDate: 'asc' }, { title: 'asc' }] } },
    });
    if (!plan) throw new AppError('Cost plan not found', 404);
    return this.withSummary(plan);
  }

  async updatePlan(id: string, data: { status?: string; notes?: string | null; ownerUserId?: string | null }, userId: string) {
    const plan = await prisma.costPlan.update({ where: { id }, data: { ...data, updatedByUserId: userId }, include: { items: true, owner: true } });
    return this.withSummary(plan);
  }

  async candidates(fiscalYearLabel: string, filters: { category?: string; sourceType?: string; search?: string } = {}) {
    const period = await fiscalYearService.getFiscalYearByLabel(fiscalYearLabel);
    const existingPlan = await prisma.costPlan.findUnique({ where: { fiscalYearLabel: period.label }, include: { items: true } });
    const existingKeys = new Set(existingPlan?.items.map((item) => item.sourceKey).filter(Boolean));
    const inPeriod = [{ gte: period.periodStart, lt: period.periodEnd }];
    const candidates: any[] = [];

    if (!filters.sourceType || filters.sourceType === 'asset') {
      const assets = await prisma.asset.findMany({ where: { isArchived: false, OR: [{ lifecycleStatus: { in: ['planned', 'ordered'] } }, { endOfLifeDate: inPeriod[0] }, { endOfSupportDate: inPeriod[0] }] } });
      for (const asset of assets) {
        candidates.push({
          candidateKey: `asset:${asset.id}`,
          sourceType: 'asset', sourceDisplayId: asset.displayId, sourceLabel: asset.name,
          title: asset.lifecycleStatus === 'planned' || asset.lifecycleStatus === 'ordered' ? `Asset procurement: ${asset.name}` : `Replacement: ${asset.name}`,
          category: 'hardware', investmentType: asset.lifecycleStatus === 'planned' || asset.lifecycleStatus === 'ordered' ? 'new_acquisition' : 'replacement',
          relevanceReason: asset.endOfLifeDate || asset.endOfSupportDate ? 'Lifecycle date in selected fiscal year' : 'Asset is planned or ordered',
          plannedAmount: null, knownAmount: null, currency: 'EUR', dueDate: (asset.endOfLifeDate || asset.endOfSupportDate)?.toISOString() ?? null,
          alreadyInPlan: existingKeys.has(`asset:${asset.id}`),
        });
      }
    }

    if (!filters.sourceType || filters.sourceType === 'license') {
      const licenses = await prisma.license.findMany({ where: { isArchived: false, OR: [{ renewalDate: inPeriod[0] }, { endDate: inPeriod[0] }] } });
      for (const license of licenses) candidates.push({ candidateKey: `license:${license.id}`, sourceType: 'license', sourceDisplayId: license.displayId, sourceLabel: license.title, title: `License renewal: ${license.title}`, category: 'license', investmentType: 'renewal', relevanceReason: 'License renewal/end date in selected fiscal year', plannedAmount: license.cost?.toString() ?? null, knownAmount: license.cost?.toString() ?? null, currency: license.currency || 'EUR', dueDate: (license.renewalDate || license.endDate)?.toISOString() ?? null, alreadyInPlan: existingKeys.has(`license:${license.id}`) });
    }

    if (!filters.sourceType || filters.sourceType === 'contract') {
      const contracts = await prisma.contract.findMany({ where: { isArchived: false, OR: [{ renewalDate: inPeriod[0] }, { endDate: inPeriod[0] }] } });
      for (const contract of contracts) candidates.push({ candidateKey: `contract:${contract.id}`, sourceType: 'contract', sourceDisplayId: contract.displayId, sourceLabel: contract.title, title: `Contract renewal: ${contract.title}`, category: 'contract', investmentType: 'renewal', relevanceReason: 'Contract renewal/end date in selected fiscal year', plannedAmount: contract.value?.toString() ?? null, knownAmount: contract.value?.toString() ?? null, currency: contract.currency || 'EUR', dueDate: (contract.renewalDate || contract.endDate)?.toISOString() ?? null, alreadyInPlan: existingKeys.has(`contract:${contract.id}`) });
    }

    return candidates.filter((c) => (!filters.category || c.category === filters.category) && (!filters.search || `${c.title} ${c.sourceDisplayId} ${c.sourceLabel}`.toLowerCase().includes(filters.search.toLowerCase())));
  }

  async takeOverCandidates(planId: string, candidateKeys: string[], userId: string) {
    const plan = await prisma.costPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new AppError('Cost plan not found', 404);
    const available = await this.candidates(plan.fiscalYearLabel);
    const byKey = new Map(available.map((c) => [c.candidateKey, c]));
    return prisma.$transaction(async (tx) => {
      const created = [];
      const skipped: string[] = [];
      for (const key of candidateKeys) {
        const candidate = byKey.get(key);
        if (!candidate) throw new AppError(`Invalid candidate key: ${key}`, 400);
        const exists = await tx.costPlanItem.findFirst({ where: { costPlanId: planId, sourceKey: key } });
        if (exists) { skipped.push(key); continue; }
        const displayId = await nextDisplayId(tx, 'CostPlanItem');
        const item = await tx.costPlanItem.create({ data: { displayId, costPlanId: planId, sourceType: candidate.sourceType, sourceKey: key, sourceAssetId: candidate.sourceType === 'asset' ? key.split(':')[1] : undefined, sourceLicenseId: candidate.sourceType === 'license' ? key.split(':')[1] : undefined, sourceContractId: candidate.sourceType === 'contract' ? key.split(':')[1] : undefined, title: candidate.title, category: candidate.category, investmentType: candidate.investmentType, relevanceReason: candidate.relevanceReason, plannedAmount: candidate.plannedAmount || '0', knownAmount: candidate.knownAmount, currency: candidate.currency, dueDate: candidate.dueDate ? new Date(candidate.dueDate) : undefined, status: 'planned', createdByUserId: userId, updatedByUserId: userId } });
        created.push(item);
      }
      await tx.auditLog.create({ data: { userId, action: 'COST_PLAN_CANDIDATES_TAKEOVER', entityType: 'CostPlan', entityId: planId, details: `Created ${created.length} items, skipped ${skipped.length}` } as any });
      return { created, skipped };
    });
  }

  async createManualItem(planId: string, data: any, userId: string) {
    return prisma.$transaction(async (tx) => {
      const displayId = await nextDisplayId(tx, 'CostPlanItem');
      const item = await tx.costPlanItem.create({ data: { ...data, displayId, costPlanId: planId, sourceType: 'manual', status: data.status || 'planned', createdByUserId: userId, updatedByUserId: userId } });
      await tx.auditLog.create({ data: { userId, action: 'COST_PLAN_ITEM_CREATE', entityType: 'CostPlanItem', entityId: item.id, details: item.title } as any });
      return item;
    });
  }

  async updateItem(itemId: string, data: any, userId: string) {
    return prisma.costPlanItem.update({ where: { id: itemId }, data: { ...data, updatedByUserId: userId } });
  }

  async markAcquired(itemId: string, data: any, userId: string) {
    return prisma.costPlanItem.update({ where: { id: itemId }, data: { ...data, status: 'acquired', acquiredAt: data.acquiredAt ? new Date(data.acquiredAt) : new Date(), updatedByUserId: userId } });
  }

  async markDone(itemId: string, userId: string, completedAt?: string) {
    return prisma.costPlanItem.update({ where: { id: itemId }, data: { status: 'done', completedAt: completedAt ? new Date(completedAt) : new Date(), completedByUserId: userId, updatedByUserId: userId } });
  }

  async exportCsv(planId: string, filters: any, userId: string) {
    const plan = await this.getPlan(planId, filters) as any;
    await prisma.auditLog.create({ data: { userId, action: 'COST_PLAN_EXPORT_CSV', entityType: 'CostPlan', entityId: plan.id, details: `Rows: ${plan.items.length}` } as any });
    const rows = [['Fiscal year','Plan display ID','Item display ID','Status','Source type','Title','Category','Investment type','Planned amount','Known amount','Currency','Due date','Supplier','Invoice number','Invoice date','Acquired at','Completed at'], ...plan.items.map((i: any) => [plan.fiscalYearLabel, plan.displayId, i.displayId, i.status, i.sourceType, i.title, i.category, i.investmentType, i.plannedAmount?.toString(), i.knownAmount?.toString() || '', i.currency, i.dueDate?.toISOString() || '', i.supplierName || '', i.invoiceNumber || '', i.invoiceDate?.toISOString() || '', i.acquiredAt?.toISOString() || '', i.completedAt?.toISOString() || ''])];
    return rows.map((row) => row.map(this.csvEscape).join(',')).join('\r\n');
  }

  async dashboardReport() {
    const years = await fiscalYearService.listSelectableYears(new Date(), 4, 1);
    const plans = await prisma.costPlan.findMany({ where: { fiscalYearLabel: { in: years.years.map((y) => y.label) } }, include: { items: true }, orderBy: { periodStart: 'asc' } });
    const currentPlan = plans.find((p) => p.fiscalYearLabel === years.current.label);
    const nextPlan = plans.find((p) => p.fiscalYearLabel === years.next.label);
    const summarize = (label: string, plan?: any) => ({ label, periodStart: (plan?.periodStart ?? years.current.periodStart).toISOString(), periodEnd: (plan?.periodEnd ?? years.current.periodEnd).toISOString(), ...this.summarizeItems(plan?.items ?? []) });
    const current = summarize(years.current.label, currentPlan);
    return { fiscalYearConfig: years.config, currentFiscalYear: current, nextFiscalYearKnownCosts: { label: years.next.label, ...this.summarizeItems(nextPlan?.items ?? []) }, historicalDevelopment: plans.map((p) => ({ fiscalYearLabel: p.fiscalYearLabel, ...this.summarizeItems(p.items) })), categoryBreakdown: this.categoryBreakdown(currentPlan?.items ?? []) };
  }

  private itemWhere(filters: any): Prisma.CostPlanItemWhereInput {
    return { category: filters.category, status: filters.status, sourceType: filters.sourceType, ...(filters.search ? { title: { contains: filters.search, mode: 'insensitive' } } : {}) };
  }

  private withSummary(plan: any) { return { ...plan, summary: this.summarizeItems(plan.items ?? []) }; }
  private summarizeItems(items: any[]) {
    const active = items.filter((i) => !['cancelled', 'rejected'].includes(i.status));
    const plannedAmount = active.reduce((s, i) => s + Number(i.plannedAmount || 0), 0);
    const knownAmount = active.reduce((s, i) => s + (i.knownAmount ? Number(i.knownAmount) : COMMITTED_STATUSES.includes(i.status) ? Number(i.plannedAmount || 0) : 0), 0);
    const acquiredAmount = active.filter((i) => ['acquired', 'done'].includes(i.status)).reduce((s, i) => s + Number(i.knownAmount || i.plannedAmount || 0), 0);
    return { plannedAmount: plannedAmount.toFixed(2), knownAmount: knownAmount.toFixed(2), acquiredAmount: acquiredAmount.toFixed(2), openAmount: (plannedAmount - acquiredAmount).toFixed(2), itemCount: active.length };
  }
  private categoryBreakdown(items: any[]) { return Object.values(items.reduce((acc, i) => { acc[i.category] ??= { category: i.category, plannedAmount: 0, knownAmount: 0, acquiredAmount: 0 }; acc[i.category].plannedAmount += Number(i.plannedAmount || 0); acc[i.category].knownAmount += Number(i.knownAmount || 0); if (['acquired', 'done'].includes(i.status)) acc[i.category].acquiredAmount += Number(i.knownAmount || i.plannedAmount || 0); return acc; }, {} as any)).map((r: any) => ({ ...r, plannedAmount: r.plannedAmount.toFixed(2), knownAmount: r.knownAmount.toFixed(2), acquiredAmount: r.acquiredAmount.toFixed(2) })); }
  private csvEscape(value: any) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
}

export const costPlanningService = new CostPlanningService();
