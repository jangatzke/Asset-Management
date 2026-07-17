import { prisma } from '../config/database';

// --- Types ---

export interface RiskAggregationGroup {
  key: string;
  label: string;
  totalRisks: number;
  riskCountBySeverity: Record<string, number>;
  totalInherentRiskScore: number;
  totalResidualRiskScore: number;
  topRisks: Array<{ id: string; title: string; inherentRisk: string; residualRisk: string }>;
}

export interface DashboardSummary {
  totalRisks: number;
  byStatus: Record<string, number>;
  byProbability: Record<string, number>;
  bySeverity: Record<string, number>;
  highRiskAssets: Array<{ assetId: string; assetName: string; riskCount: number }>;
}

// Helper to classify risk level from inherentRisk string
function classifyRiskLevel(riskValue: string): 'high' | 'medium' | 'low' {
  const lower = riskValue.toLowerCase();
  if (lower.includes('high') || lower.includes('critical')) return 'high';
  if (lower.includes('medium') || lower.includes('moderate')) return 'medium';
  return 'low';
}

// Helper to build aggregation result from a group of risks
function buildAggregationGroup(
  key: string,
  label: string,
  risks: any[]
): RiskAggregationGroup {
  const severityCounts: Record<string, number> = {};
  let totalInherent = 0;
  let totalResidual = 0;

  for (const r of risks) {
    const level = classifyRiskLevel(r.inherentRisk);
    severityCounts[level] = (severityCounts[level] || 0) + 1;
    // Use likelihood * impact as numeric risk score
    totalInherent += (r.likelihood ?? 0) * (r.impact ?? 0);
    totalResidual += (r.residualLikelihood ?? r.likelihood ?? 0) * (r.residualImpact ?? r.impact ?? 0);
  }

  // Top risks sorted by inherent risk score descending
  const topRisks = [...risks]
    .sort((a, b) => (b.likelihood * b.impact) - (a.likelihood * a.impact))
    .slice(0, 10)
    .map(r => ({
      id: r.id,
      title: r.title,
      inherentRisk: r.inherentRisk,
      residualRisk: r.residualRisk,
    }));

  return {
    key,
    label,
    totalRisks: risks.length,
    riskCountBySeverity: severityCounts,
    totalInherentRiskScore: Math.round(totalInherent * 100) / 100,
    totalResidualRiskScore: Math.round(totalResidual * 100) / 100,
    topRisks,
  };
}

export class RiskAggregationService {
  // RSK-011: Aggregate risks by organization unit
  async aggregateByOrganizationUnit(): Promise<RiskAggregationGroup[]> {
    const risks = await prisma.risk.findMany({
      include: { organizationUnit: true },
      where: { isArchived: false },
    });

    const groups = new Map<string, { label: string; risks: typeof risks }>();
    for (const risk of risks) {
      const key = risk.organizationUnit?.id ?? 'unassigned';
      const label = risk.organizationUnit?.name ?? 'Unassigned';
      if (!groups.has(key)) groups.set(key, { label, risks: [] });
      groups.get(key)!.risks.push(risk);
    }

    return Array.from(groups.entries()).map(([key, { label, risks }]) =>
      buildAggregationGroup(key, label, risks)
    );
  }

  // RSK-011: Aggregate risks by location/site
  async aggregateByLocation(): Promise<RiskAggregationGroup[]> {
    const risks = await prisma.risk.findMany({
      where: { isArchived: false },
    });

    const groups = new Map<string, { label: string; risks: typeof risks }>();

    for (const risk of risks) {
      if (risk.affectedAssetIds.length === 0) {
        if (!groups.has('no-location')) groups.set('no-location', { label: 'No Location', risks: [] });
        groups.get('no-location')!.risks.push(risk);
        continue;
      }

      const assets = await prisma.asset.findMany({
        where: { id: { in: risk.affectedAssetIds } },
        include: { location: true },
      });

      for (const asset of assets) {
        if (!asset.location) {
          if (!groups.has('unlocated')) groups.set('unlocated', { label: 'Unlocated', risks: [] });
          groups.get('unlocated')!.risks.push(risk);
        } else {
          const key = asset.location.id;
          const label = `${asset.location.name} (${asset.location.city}, ${asset.location.country})`;
          if (!groups.has(key)) groups.set(key, { label, risks: [] });
          groups.get(key)!.risks.push(risk);
        }
      }
    }

    return Array.from(groups.entries()).map(([key, { label, risks }]) =>
      buildAggregationGroup(key, label, risks)
    );
  }

  // RSK-011: Aggregate risks by asset type
  async aggregateByAssetType(): Promise<RiskAggregationGroup[]> {
    const risks = await prisma.risk.findMany({ where: { isArchived: false } });

    const groups = new Map<string, { label: string; risks: any[] }>();

    for (const risk of risks) {
      if (risk.affectedAssetIds.length === 0) {
        if (!groups.has('no-asset')) groups.set('no-asset', { label: 'No Asset', risks: [] });
        groups.get('no-asset')!.risks.push(risk);
        continue;
      }

      const assets = await prisma.asset.findMany({
        where: { id: { in: risk.affectedAssetIds } },
        include: { assetType: true },
      });

      for (const asset of assets) {
        const typeKey = asset.assetTypeId;
        const typeLabel = asset.assetType.name;
        if (!groups.has(typeKey)) groups.set(typeKey, { label: typeLabel, risks: [] });
        groups.get(typeKey)!.risks.push(risk);
      }
    }

    return Array.from(groups.entries()).map(([key, { label, risks }]) =>
      buildAggregationGroup(key, label, risks)
    );
  }

  // RSK-010/RSK-011: Aggregate risks by business process
  async aggregateByBusinessProcess(): Promise<RiskAggregationGroup[]> {
    const risks = await prisma.risk.findMany({
      include: { businessProcess: true },
      where: { isArchived: false },
    });

    const groups = new Map<string, { label: string; risks: typeof risks }>();
    for (const risk of risks) {
      const key = risk.businessProcess?.id ?? 'unassigned';
      const label = risk.businessProcess?.name ?? 'No Business Process';
      if (!groups.has(key)) groups.set(key, { label, risks: [] });
      groups.get(key)!.risks.push(risk);
    }

    return Array.from(groups.entries()).map(([key, { label, risks }]) =>
      buildAggregationGroup(key, label, risks)
    );
  }

  // RSK-011: Aggregate risks within ISMS scope
  async aggregateByScope(): Promise<RiskAggregationGroup[]> {
    const scopes = await prisma.ismsScope.findMany({
      where: { isArchived: false, approvalStatus: 'approved' },
    });

    if (scopes.length === 0) return [];

    const risks = await prisma.risk.findMany({
      include: { organizationUnit: true },
      where: { isArchived: false },
    });

    // Group risks by which scope they fall into based on org units, assets, processes
    const groups = new Map<string, { label: string; risks: typeof risks }>();

    for (const scope of scopes) {
      const key = scope.id;
      const label = scope.name;
      groups.set(key, { label, risks: [] });

      const includedOrgUnits = (scope.includedCompanies as any[]) || [];
      const includedProcesses = (scope.includedBusinessProcesses as any[]) || [];

      for (const risk of risks) {
        let inScope = false;

        // Check if risk's org unit is in scope
        if (risk.organizationUnitId && includedOrgUnits.includes(risk.organizationUnitId)) {
          inScope = true;
        }

        // Check if affected processes are in scope
        if (!inScope && risk.affectedProcessIds.length > 0) {
          for (const procId of risk.affectedProcessIds) {
            if (includedProcesses.includes(procId)) {
              inScope = true;
              break;
            }
          }
        }

        // If scope has no specific filters, include all active risks
        if (!inScope && includedOrgUnits.length === 0 && includedProcesses.length === 0) {
          inScope = true;
        }

        if (inScope) {
          groups.get(key)!.risks.push(risk);
        }
      }
    }

    return Array.from(groups.entries()).map(([key, { label, risks }]) =>
      buildAggregationGroup(key, label, risks)
    );
  }

  // Get risk dashboard summary
  async getDashboardSummary(): Promise<DashboardSummary> {
    const risks = await prisma.risk.findMany({
      where: { isArchived: false },
    });

    const totalRisks = risks.length;

    // By status
    const byStatus: Record<string, number> = {};
    for (const risk of risks) {
      byStatus[risk.status] = (byStatus[risk.status] || 0) + 1;
    }

    // By probability (likelihood - numeric scale)
    const byProbability: Record<string, number> = {};
    for (const risk of risks) {
      const key = `Level ${risk.likelihood}`;
      byProbability[key] = (byProbability[key] || 0) + 1;
    }

    // By severity (impact - numeric scale)
    const bySeverity: Record<string, number> = {};
    for (const risk of risks) {
      const key = `Level ${risk.impact}`;
      bySeverity[key] = (bySeverity[key] || 0) + 1;
    }

    // High-risk assets - find assets with most high-severity risks
    const assetRiskCounts = new Map<string, { name: string; count: number }>();

    for (const risk of risks) {
      if (classifyRiskLevel(risk.inherentRisk) === 'high') {
        for (const assetId of risk.affectedAssetIds) {
          if (!assetRiskCounts.has(assetId)) {
            const asset = await prisma.asset.findUnique({ where: { id: assetId } });
            assetRiskCounts.set(assetId, {
              name: asset?.name ?? 'Unknown',
              count: 0,
            });
          }
          assetRiskCounts.get(assetId)!.count += 1;
        }
      }
    }

    const highRiskAssets = Array.from(assetRiskCounts.entries())
      .map(([assetId, { name, count }]) => ({
        assetId,
        assetName: name,
        riskCount: count,
      }))
      .sort((a, b) => b.riskCount - a.riskCount);

    return {
      totalRisks,
      byStatus,
      byProbability,
      bySeverity,
      highRiskAssets,
    };
  }

}

export const riskAggregationService = new RiskAggregationService();
