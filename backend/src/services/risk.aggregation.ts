/**
 * RiskAggregationService — Paket 3.4
 *
 * Produziert reproduzierbare, normalisierte Risiko-Aggregationen über Junction Tables
 * (RiskAsset, RiskProcess, RiskService) mit Prisma groupBy/parametrisierten Queries.
 * Keine N+1-Loops mehr.
 *
 * Zählregeln:
 * - Ein Risiko wird pro Gruppe genau einmal gezählt (DISTINCT risk.id).
 * - Bei Mehrfachzuordnungen (z.B. ein Risiko → mehrere Assets) wird das Risiko
 *   in JEDE betroffene Gruppe aufgenommen, aber pro Gruppe dedupliziert.
 * - Aggregationen beziehen sich standardmäßig auf die aktuelle Assessment-Version
 *   (isCurrent=true) von RiskAssessmentVersion; historische Kennzahlen können über
 *   methodVersionId + Zeitraum rekonstruiert werden.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** Einzelne Aggregationsgruppe (z.B. ein Asset, eine Organisationseinheit) */
export interface RiskAggregationGroup {
  key: string;
  label: string;
  totalRisks: number;
  riskCountBySeverity: Record<string, number>;
  totalInherentRiskScore: number;
  totalResidualRiskScore: number;
  topRisks: Array<{ id: string; title: string; inherentRisk: string; residualRisk: string }>;
}

/** Dashboard-Zusammenfassung */
export interface DashboardSummary {
  totalRisks: number;
  byStatus: Record<string, number>;
  byProbability: Record<string, number>;
  bySeverity: Record<string, number>;
  highRiskAssets: Array<{ assetId: string; assetName: string; riskCount: number }>;
}

/** Filter-Optionen für alle Aggregationen */
export interface AggregationFilters {
  from?: Date;       // Zeitraum-Start (bezieht sich auf assessedAt von RiskAssessmentVersion)
  to?: Date;         // Zeitraum-Ende
  scope?: string[];  // ISMS-Scope-IDs (optional, zukünftig)
  organizationUnitId?: string;
  status?: string;   // RiskStatus-Wert (identified, assessed, …)
  riskClass?: string;
  assessmentType?: 'inherent' | 'current' | 'target';
  methodVersionId?: string;
  isCurrent?: boolean; // Nur aktuelle RiskAssessmentVersion berücksichtigen (Standard: true)
}

// ─────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────

/** Klassifiziert einen inherentRisk-String in high/medium/low */
function classifyRiskLevel(riskValue: string): 'high' | 'medium' | 'low' {
  const lower = riskValue.toLowerCase();
  if (lower.includes('high') || lower.includes('critical')) return 'high';
  if (lower.includes('medium') || lower.includes('moderate')) return 'medium';
  return 'low';
}

/**
 * Baut eine Aggregationsgruppe aus einer Liste von Risiko-Datensätzen.
 * Nutzt DISTINCT risk.id für korrekte Zählung.
 */
function buildAggregationGroup(
  key: string,
  label: string,
  risks: Array<{
    id: string;
    title: string;
    inherentRisk: string;
    residualRisk: string;
    likelihood: number;
    impact: number;
    residualLikelihood?: number;
    residualImpact?: number;
  }>,
): RiskAggregationGroup {
  // Dedupliziere nach id (sollte bereits eindeutig sein, aber sicherheitshalber)
  const uniqueRisks = new Map<string, typeof risks[number]>();
  for (const r of risks) {
    if (!uniqueRisks.has(r.id)) {
      uniqueRisks.set(r.id, r);
    }
  }

  const severityCounts: Record<string, number> = {};
  let totalInherent = 0;
  let totalResidual = 0;

  for (const r of uniqueRisks.values()) {
    const level = classifyRiskLevel(r.inherentRisk);
    severityCounts[level] = (severityCounts[level] || 0) + 1;
    totalInherent += (r.likelihood ?? 0) * (r.impact ?? 0);
    totalResidual +=
      ((r.residualLikelihood ?? r.likelihood) ?? 0) *
      ((r.residualImpact ?? r.impact) ?? 0);
  }

  const sorted = [...uniqueRisks.values()].sort(
    (a, b) => (b.likelihood * b.impact) - (a.likelihood * a.impact),
  );

  return {
    key,
    label,
    totalRisks: uniqueRisks.size,
    riskCountBySeverity: severityCounts,
    totalInherentRiskScore: Math.round(totalInherent * 100) / 100,
    totalResidualRiskScore: Math.round(totalResidual * 100) / 100,
    topRisks: sorted.slice(0, 10).map((r) => ({
      id: r.id,
      title: r.title,
      inherentRisk: r.inherentRisk,
      residualRisk: r.residualRisk,
    })),
  };
}

/**
 * Baut WHERE-Klauseln für Aggregation-Filter dynamisch und sicher auf.
 * Zeitraum, AssessmentType und Current-State beziehen sich auf RiskAssessmentVersion.assessedAt.
 */
function buildAggregationWhere(filters: AggregationFilters): Prisma.RiskWhereInput {
  const conditions: Prisma.RiskWhereInput[] = [{ isArchived: false }];

  if (filters.status) conditions.push({ status: filters.status });
  if (filters.organizationUnitId) conditions.push({ organizationUnitId: filters.organizationUnitId });
  if (filters.methodVersionId) conditions.push({ riskMethodVersionId: filters.methodVersionId });

  const assessmentSome: Prisma.RiskAssessmentVersionWhereInput = {};
  if (filters.assessmentType) assessmentSome.assessmentType = filters.assessmentType;
  if (filters.methodVersionId) assessmentSome.riskMethodVersionId = filters.methodVersionId;
  if (filters.isCurrent !== false) assessmentSome.isCurrent = true;
  if (filters.from || filters.to) {
    assessmentSome.assessedAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  if (Object.keys(assessmentSome).length > 0) {
    conditions.push({ riskAssessmentVersions: { some: assessmentSome } } as any);
  }

  return conditions.length === 1 ? conditions[0] : { AND: conditions };
}

// ─────────────────────────────────────────────
// Service-Klasse
// ─────────────────────────────────────────────

export class RiskAggregationService {

  // ────────────────────────────────────────
  // RSK-011: Aggregation nach Organisationseinheit (Junction Table)
  // ────────────────────────────────────────
  /**
   * Gruppiert Risiken nach OrganizationUnit.
   * Nutzt direkte FK organizationUnitId auf Risk — keine ID-Arrays.
   * Pro Gruppe werden Risiken DISTINCT nach risk.id gezählt.
   */
  async aggregateByOrganizationUnit(
    filters: AggregationFilters = {},
  ): Promise<RiskAggregationGroup[]> {
    const risks = await prisma.risk.findMany({
      where: buildAggregationWhere(filters),
      select: {
        id: true,
        title: true,
        inherentRisk: true,
        residualRisk: true,
        likelihood: true,
        impact: true,
                organizationUnit: { select: { id: true, name: true } },
      },
    });

    const groups = new Map<string, { label: string; risks: typeof risks }>();
    for (const risk of risks) {
      const key = risk.organizationUnit?.id ?? 'unassigned';
      const label = risk.organizationUnit?.name ?? 'Unassigned';
      if (!groups.has(key)) groups.set(key, { label, risks: [] });
      groups.get(key)!.risks.push(risk);
    }

    return Array.from(groups.entries()).map(([key, { label, risks }]) =>
      buildAggregationGroup(key, label, risks),
    );
  }

  // ────────────────────────────────────────
  // RSK-011: Aggregation nach Standort (über RiskAsset Junction Table)
  // ────────────────────────────────────────
  /**
   * Gruppiert Risiken nach Location der zugehörigen Assets.
   * Verwendet RiskAsset → Asset → Location Kette.
   * Ein Risiko erscheint in jeder Location-Gruppe, zu der ein zugeordnetes Asset gehört.
   */
  async aggregateByLocation(filters: AggregationFilters = {}): Promise<RiskAggregationGroup[]> {
    const risks = await prisma.risk.findMany({
      where: buildAggregationWhere(filters),
      select: {
        id: true,
        title: true,
        inherentRisk: true,
        residualRisk: true,
        likelihood: true,
        impact: true,
                riskAssets: {
          select: { assetId: true },
        },
      },
    });

    // Batch-Lookup aller Asset-IDs (keine N+1)
    const allAssetIds = [...new Set(risks.flatMap((r) => r.riskAssets.map((la) => la.assetId)))];
    const assets = allAssetIds.length
      ? await prisma.asset.findMany({
          where: { id: { in: allAssetIds } },
          select: { id: true, locationId: true, location: { select: { id: true, name: true, city: true, country: true } } },
        })
      : [];

    const assetMap = new Map<string, typeof assets[number]>();
    for (const a of assets) assetMap.set(a.id, a);

    // Gruppiere: risk → location
    const groups = new Map<string, { label: string; riskIds: Set<string> }>();

    for (const risk of risks) {
      if (risk.riskAssets.length === 0) {
        const key = 'no-location';
        if (!groups.has(key)) groups.set(key, { label: 'No Location', riskIds: new Set() });
        groups.get(key)!.riskIds.add(risk.id);
        continue;
      }

      let assigned = false;
      for (const link of risk.riskAssets) {
        const asset = assetMap.get(link.assetId);
        if (!asset) continue;
        if (!asset.locationId) {
          const key = 'unlocated';
          if (!groups.has(key)) groups.set(key, { label: 'Unlocated', riskIds: new Set() });
          groups.get(key)!.riskIds.add(risk.id);
        } else {
          const loc = asset.location!;
          const key = loc.id;
          const label = `${loc.name} (${loc.city}, ${loc.country})`;
          if (!groups.has(key)) groups.set(key, { label, riskIds: new Set() });
          groups.get(key)!.riskIds.add(risk.id);
        }
        assigned = true;
      }
      // Wenn kein Asset eine Location hat, aber Assets vorhanden sind → auch "unlocated"
      if (!assigned && risk.riskAssets.length > 0) {
        const key = 'unlocated';
        if (!groups.has(key)) groups.set(key, { label: 'Unlocated', riskIds: new Set() });
        groups.get(key)!.riskIds.add(risk.id);
      }
    }

    // Hole Assessment-Daten für die gesammelten Risiko-IDs
    const allRiskIds = [...new Set(groups.values()).values()].flatMap((g) => [...g.riskIds]);
    const uniqueAllRiskIds = [...new Set(allRiskIds)];

    const riskDataMap = new Map<string, any>();
    if (uniqueAllRiskIds.length > 0) {
      const riskDatas = await prisma.risk.findMany({
        where: { id: { in: uniqueAllRiskIds } },
        select: {
          id: true, title: true, inherentRisk: true, residualRisk: true,
          likelihood: true, impact: true,
        },
      });
      for (const rd of riskDatas) riskDataMap.set(rd.id, rd);
    }

    return Array.from(groups.entries()).map(([key, { label, riskIds }]) => {
      const risks = [...riskIds]
        .map((id) => riskDataMap.get(id))
        .filter(Boolean);
      return buildAggregationGroup(key, label, risks);
    });
  }

  // ────────────────────────────────────────
  // RSK-011: Aggregation nach Asset-Typ (über RiskAsset Junction Table)
  // ────────────────────────────────────────
  /**
   * Gruppiert Risiken nach Asset-Typ.
   * Verwendet RiskAsset → Asset → AssetType Kette.
   */
  async aggregateByAssetType(filters: AggregationFilters = {}): Promise<RiskAggregationGroup[]> {
    const risks = await prisma.risk.findMany({
      where: buildAggregationWhere(filters),
      select: {
        id: true, title: true, inherentRisk: true, residualRisk: true,
        likelihood: true, impact: true,
        riskAssets: { select: { assetId: true } },
      },
    });

    const allAssetIds = [...new Set(risks.flatMap((r) => r.riskAssets.map((la) => la.assetId)))];
    const assets = allAssetIds.length
      ? await prisma.asset.findMany({
          where: { id: { in: allAssetIds } },
          select: { id: true, assetTypeId: true, assetType: { select: { id: true, name: true } } },
        })
      : [];

    const assetMap = new Map<string, typeof assets[number]>();
    for (const a of assets) assetMap.set(a.id, a);

    const groups = new Map<string, { label: string; riskIds: Set<string> }>();

    for (const risk of risks) {
      if (risk.riskAssets.length === 0) {
        const key = 'no-asset';
        if (!groups.has(key)) groups.set(key, { label: 'No Asset', riskIds: new Set() });
        groups.get(key)!.riskIds.add(risk.id);
        continue;
      }

      for (const link of risk.riskAssets) {
        const asset = assetMap.get(link.assetId);
        if (!asset) continue;
        const typeKey = asset.assetTypeId ?? 'unknown-type';
        const typeLabel = asset.assetType?.name ?? 'Unknown Type';
        if (!groups.has(typeKey)) groups.set(typeKey, { label: typeLabel, riskIds: new Set() });
        groups.get(typeKey)!.riskIds.add(risk.id);
      }
    }

    const allRiskIds = [...new Set([...groups.values()].flatMap((g) => [...g.riskIds]))];
    const riskDataMap = new Map<string, any>();
    if (allRiskIds.length > 0) {
      const riskDatas = await prisma.risk.findMany({
        where: { id: { in: allRiskIds } },
        select: { id: true, title: true, inherentRisk: true, residualRisk: true, likelihood: true, impact: true },
      });
      for (const rd of riskDatas) riskDataMap.set(rd.id, rd);
    }

    return Array.from(groups.entries()).map(([key, { label, riskIds }]) => {
      const risks = [...riskIds].map((id) => riskDataMap.get(id)).filter(Boolean);
      return buildAggregationGroup(key, label, risks);
    });
  }

  // ────────────────────────────────────────
  // RSK-010/RSK-011: Aggregation nach Business Process (über RiskProcess Junction Table)
  // ────────────────────────────────────────
  /**
   * Gruppiert Risiken nach BusinessProcess über die RiskProcess Junction Table.
   * Verwendet keine denormalisierten affectedProcessIds mehr.
   */
  async aggregateByBusinessProcess(filters: AggregationFilters = {}): Promise<RiskAggregationGroup[]> {
    const risks = await prisma.risk.findMany({
      where: buildAggregationWhere(filters),
      select: {
        id: true, title: true, inherentRisk: true, residualRisk: true,
        likelihood: true, impact: true,
        processLinks: { select: { processId: true } },
        businessProcessId: true, // Legacy-Fallback
      },
    });

    const allProcessIds = [...new Set(risks.flatMap((r) => r.processLinks.map((pl) => pl.processId)))];
    const processes = allProcessIds.length
      ? await prisma.businessProcess.findMany({
          where: { id: { in: allProcessIds } },
          select: { id: true, name: true },
        })
      : [];

    const processMap = new Map<string, typeof processes[number]>();
    for (const p of processes) processMap.set(p.id, p);

    const groups = new Map<string, { label: string; riskIds: Set<string> }>();

    for (const risk of risks) {
      if (risk.processLinks.length === 0 && !risk.businessProcessId) {
        const key = 'unassigned';
        if (!groups.has(key)) groups.set(key, { label: 'No Business Process', riskIds: new Set() });
        groups.get(key)!.riskIds.add(risk.id);
        continue;
      }

      for (const link of risk.processLinks) {
        const proc = processMap.get(link.processId);
        if (!proc) continue;
        if (!groups.has(proc.id)) groups.set(proc.id, { label: proc.name, riskIds: new Set() });
        groups.get(proc.id)!.riskIds.add(risk.id);
      }

      // Legacy-Fallback: wenn processLinks leer aber businessProcessId gesetzt
      if (risk.processLinks.length === 0 && risk.businessProcessId) {
        const key = risk.businessProcessId;
        const label = `Legacy (${key})`;
        if (!groups.has(key)) groups.set(key, { label, riskIds: new Set() });
        groups.get(key)!.riskIds.add(risk.id);
      }
    }

    const allRiskIds = [...new Set([...groups.values()].flatMap((g) => [...g.riskIds]))];
    const riskDataMap = new Map<string, any>();
    if (allRiskIds.length > 0) {
      const riskDatas = await prisma.risk.findMany({
        where: { id: { in: allRiskIds } },
        select: { id: true, title: true, inherentRisk: true, residualRisk: true, likelihood: true, impact: true },
      });
      for (const rd of riskDatas) riskDataMap.set(rd.id, rd);
    }

    return Array.from(groups.entries()).map(([key, { label, riskIds }]) => {
      const risks = [...riskIds].map((id) => riskDataMap.get(id)).filter(Boolean);
      return buildAggregationGroup(key, label, risks);
    });
  }

  // ────────────────────────────────────────
  // RSK-011: Aggregation nach Business Service (über RiskService Junction Table)
  // ────────────────────────────────────────
  /**
   * Gruppiert Risiken nach BusinessService über die RiskService Junction Table.
   */
  async aggregateByService(filters: AggregationFilters = {}): Promise<RiskAggregationGroup[]> {
    const risks = await prisma.risk.findMany({
      where: buildAggregationWhere(filters),
      select: {
        id: true, title: true, inherentRisk: true, residualRisk: true,
        likelihood: true, impact: true,
        serviceLinks: { select: { serviceId: true } },
      },
    });

    const allServiceIds = [...new Set(risks.flatMap((r) => r.serviceLinks.map((sl) => sl.serviceId)))];
    const services = allServiceIds.length
      ? await prisma.businessService.findMany({
          where: { id: { in: allServiceIds } },
          select: { id: true, name: true },
        })
      : [];

    const serviceMap = new Map<string, typeof services[number]>();
    for (const s of services) serviceMap.set(s.id, s);

    const groups = new Map<string, { label: string; riskIds: Set<string> }>();

    for (const risk of risks) {
      if (risk.serviceLinks.length === 0) {
        const key = 'no-service';
        if (!groups.has(key)) groups.set(key, { label: 'No Service', riskIds: new Set() });
        groups.get(key)!.riskIds.add(risk.id);
        continue;
      }

      for (const link of risk.serviceLinks) {
        const svc = serviceMap.get(link.serviceId);
        if (!svc) continue;
        if (!groups.has(svc.id)) groups.set(svc.id, { label: svc.name, riskIds: new Set() });
        groups.get(svc.id)!.riskIds.add(risk.id);
      }
    }

    const allRiskIds = [...new Set([...groups.values()].flatMap((g) => [...g.riskIds]))];
    const riskDataMap = new Map<string, any>();
    if (allRiskIds.length > 0) {
      const riskDatas = await prisma.risk.findMany({
        where: { id: { in: allRiskIds } },
        select: { id: true, title: true, inherentRisk: true, residualRisk: true, likelihood: true, impact: true },
      });
      for (const rd of riskDatas) riskDataMap.set(rd.id, rd);
    }

    return Array.from(groups.entries()).map(([key, { label, riskIds }]) => {
      const risks = [...riskIds].map((id) => riskDataMap.get(id)).filter(Boolean);
      return buildAggregationGroup(key, label, risks);
    });
  }

  // ────────────────────────────────────────
  // RSK-011: Aggregation nach ISMS Scope
  // ────────────────────────────────────────
  /**
   * Gruppiert Risiken innerhalb genehmigter ISMS-Scope-Grenzen.
   * Nutzt OrganizationUnit und RiskProcess Junction Tables für Scope-Matching.
   */
  async aggregateByScope(filters: AggregationFilters = {}): Promise<RiskAggregationGroup[]> {
    const scopes = await prisma.ismsScope.findMany({
      where: { isArchived: false, approvalStatus: 'approved' },
    });

    if (scopes.length === 0) return [];

    // Hole alle Risiken mit OrgUnit und ProcessLinks
    const baseWhere = buildAggregationWhere(filters);
    const risks = await prisma.risk.findMany({
      where: { ...baseWhere, isArchived: false },
      select: {
        id: true, title: true, inherentRisk: true, residualRisk: true,
        likelihood: true, impact: true,
        organizationUnitId: true,
        processLinks: { select: { processId: true } },
      },
    });

    const groups = new Map<string, { label: string; riskIds: Set<string> }>();

    for (const scope of scopes) {
      const key = scope.id;
      const label = scope.name;
      groups.set(key, { label, riskIds: new Set() });

      const includedOrgUnits = (scope.includedCompanies as string[]) || [];
      const includedProcesses = (scope.includedBusinessProcesses as string[]) || [];

      for (const risk of risks) {
        let inScope = false;

        if (risk.organizationUnitId && includedOrgUnits.includes(risk.organizationUnitId)) {
          inScope = true;
        }

        if (!inScope && includedProcesses.length > 0) {
          for (const procId of risk.processLinks.map((pl) => pl.processId)) {
            if (includedProcesses.includes(procId)) {
              inScope = true;
              break;
            }
          }
        }

        // Wenn Scope keine spezifischen Filter hat → alle Risiken einschließen
        if (!inScope && includedOrgUnits.length === 0 && includedProcesses.length === 0) {
          inScope = true;
        }

        if (inScope) {
          groups.get(key)!.riskIds.add(risk.id);
        }
      }
    }

    const allRiskIds = [...new Set([...groups.values()].flatMap((g) => [...g.riskIds]))];
    const riskDataMap = new Map<string, any>();
    if (allRiskIds.length > 0) {
      const riskDatas = await prisma.risk.findMany({
        where: { id: { in: allRiskIds } },
        select: { id: true, title: true, inherentRisk: true, residualRisk: true, likelihood: true, impact: true },
      });
      for (const rd of riskDatas) riskDataMap.set(rd.id, rd);
    }

    return Array.from(groups.entries()).map(([key, { label, riskIds }]) => {
      const risks = [...riskIds].map((id) => riskDataMap.get(id)).filter(Boolean);
      return buildAggregationGroup(key, label, risks);
    });
  }

  // ────────────────────────────────────────
  // RSK-011: Aggregation nach Risikoklasse (über RiskAssessmentVersion + methodVersion riskClasses)
  // ────────────────────────────────────────
  /**
   * Gruppiert Risiken nach ihrer berechneten Risikoklasse.
   * Verwendet die riskClasses-Definition aus der gebundenen RiskMethodVersion.
   */
  async aggregateByRiskClass(filters: AggregationFilters = {}): Promise<RiskAggregationGroup[]> {
    const risks = await prisma.risk.findMany({
      where: buildAggregationWhere(filters),
      select: {
        id: true, title: true, inherentRisk: true, residualRisk: true,
        likelihood: true, impact: true,
        riskMethodVersionId: true,
      },
    });

    // Gruppiere nach inherentRisk level (high/medium/low) als Proxy für Risikoklasse
    const groups = new Map<string, { label: string; riskIds: Set<string> }>();

    for (const risk of risks) {
      const level = classifyRiskLevel(risk.inherentRisk);
      if (!groups.has(level)) groups.set(level, { label: level.charAt(0).toUpperCase() + level.slice(1), riskIds: new Set() });
      groups.get(level)!.riskIds.add(risk.id);
    }

    const allRiskIds = [...new Set([...groups.values()].flatMap((g) => [...g.riskIds]))];
    const riskDataMap = new Map<string, any>();
    if (allRiskIds.length > 0) {
      const riskDatas = await prisma.risk.findMany({
        where: { id: { in: allRiskIds } },
        select: { id: true, title: true, inherentRisk: true, residualRisk: true, likelihood: true, impact: true },
      });
      for (const rd of riskDatas) riskDataMap.set(rd.id, rd);
    }

    return Array.from(groups.entries()).map(([key, { label, riskIds }]) => {
      const risks = [...riskIds].map((id) => riskDataMap.get(id)).filter(Boolean);
      return buildAggregationGroup(key, label, risks);
    });
  }

  // ────────────────────────────────────────
  // RSK-011: Aggregation nach Status
  // ────────────────────────────────────────
  /**
   * Gruppiert Risiken nach ihrem aktuellen Status.
   */
  async aggregateByStatus(filters: AggregationFilters = {}): Promise<RiskAggregationGroup[]> {
    const risks = await prisma.risk.findMany({
      where: buildAggregationWhere(filters),
      select: {
        id: true, title: true, inherentRisk: true, residualRisk: true,
        likelihood: true, impact: true,
        status: true,
      },
    });

    const groups = new Map<string, { label: string; riskIds: Set<string> }>();

    for (const risk of risks) {
      if (!groups.has(risk.status)) groups.set(risk.status, { label: risk.status, riskIds: new Set() });
      groups.get(risk.status)!.riskIds.add(risk.id);
    }

    const allRiskIds = [...new Set([...groups.values()].flatMap((g) => [...g.riskIds]))];
    const riskDataMap = new Map<string, any>();
    if (allRiskIds.length > 0) {
      const riskDatas = await prisma.risk.findMany({
        where: { id: { in: allRiskIds } },
        select: { id: true, title: true, inherentRisk: true, residualRisk: true, likelihood: true, impact: true },
      });
      for (const rd of riskDatas) riskDataMap.set(rd.id, rd);
    }

    return Array.from(groups.entries()).map(([key, { label, riskIds }]) => {
      const risks = [...riskIds].map((id) => riskDataMap.get(id)).filter(Boolean);
      return buildAggregationGroup(key, label, risks);
    });
  }

  // ────────────────────────────────────────
  // RSK-011: Aggregation nach Assessment Type
  // ────────────────────────────────────────
  /**
   * Gruppiert Risiken nach assessmentType (inherent/current/target) über RiskAssessmentVersion.
   */
  async aggregateByAssessmentType(filters: AggregationFilters = {}): Promise<RiskAggregationGroup[]> {
    const risks = await prisma.risk.findMany({
      where: buildAggregationWhere(filters),
      select: {
        id: true, title: true, inherentRisk: true, residualRisk: true,
        likelihood: true, impact: true,
        riskAssessmentVersions: {
          where: filters.assessmentType ? { assessmentType: filters.assessmentType } : undefined,
          select: { assessmentType: true },
          take: 1,
        },
      },
    });

    const groups = new Map<string, { label: string; riskIds: Set<string> }>();

    for (const risk of risks) {
      const atype = risk.riskAssessmentVersions?.[0]?.assessmentType ?? 'current';
      if (!groups.has(atype)) groups.set(atype, { label: atype.charAt(0).toUpperCase() + atype.slice(1), riskIds: new Set() });
      groups.get(atype)!.riskIds.add(risk.id);
    }

    const allRiskIds = [...new Set([...groups.values()].flatMap((g) => [...g.riskIds]))];
    const riskDataMap = new Map<string, any>();
    if (allRiskIds.length > 0) {
      const riskDatas = await prisma.risk.findMany({
        where: { id: { in: allRiskIds } },
        select: { id: true, title: true, inherentRisk: true, residualRisk: true, likelihood: true, impact: true },
      });
      for (const rd of riskDatas) riskDataMap.set(rd.id, rd);
    }

    return Array.from(groups.entries()).map(([key, { label, riskIds }]) => {
      const risks = [...riskIds].map((id) => riskDataMap.get(id)).filter(Boolean);
      return buildAggregationGroup(key, label, risks);
    });
  }

  // ────────────────────────────────────────
  // Dashboard Summary (optimiert)
  // ────────────────────────────────────────
  /**
   * Liefert eine Dashboard-Zusammenfassung.
   * Nutzt Prisma groupBy für byStatus, byProbability, bySeverity — keine N+1.
   */
  async getDashboardSummary(filters: AggregationFilters = {}): Promise<DashboardSummary> {
    const where = buildAggregationWhere(filters);

    // Gesamtanzahl
    const totalRisks = await prisma.risk.count({ where });

    // By Status — Prisma groupBy (SQL GROUP BY)
    const statusGroups = await prisma.risk.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });
    const byStatus: Record<string, number> = {};
    for (const g of statusGroups) byStatus[g.status] = g._count.status;

    // By Probability (likelihood bucket)
    const probabilityGroups = await prisma.risk.groupBy({
      by: ['likelihood'],
      where,
      _count: { likelihood: true },
    });
    const byProbability: Record<string, number> = {};
    for (const g of probabilityGroups) byProbability[`Level ${g.likelihood}`] = g._count.likelihood;

    // By Severity (impact bucket)
    const severityGroups = await prisma.risk.groupBy({
      by: ['impact'],
      where,
      _count: { impact: true },
    });
    const bySeverity: Record<string, number> = {};
    for (const g of severityGroups) bySeverity[`Level ${g.impact}`] = g._count.impact;

    // High-Risk Assets — batchweise über RiskAsset Junction Table
    const highRisks = await prisma.risk.findMany({
      where: { ...where, inherentRisk: { contains: 'high', mode: 'insensitive' } } as any,
      select: { riskAssets: { select: { assetId: true } } },
      take: 500, // Obergrenze für Performance
    });

    const assetRiskCounts = new Map<string, number>();
    for (const risk of highRisks) {
      for (const link of risk.riskAssets) {
        assetRiskCounts.set(link.assetId, (assetRiskCounts.get(link.assetId) || 0) + 1);
      }
    }

    const topAssetIds = [...assetRiskCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([assetId]) => assetId);

    const assets = topAssetIds.length
      ? await prisma.asset.findMany({
          where: { id: { in: topAssetIds } },
          select: { id: true, name: true },
        })
      : [];

    const assetNameMap = new Map<string, string>();
    for (const a of assets) assetNameMap.set(a.id, a.name);

    const highRiskAssets = [...assetRiskCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([assetId, riskCount]) => ({
        assetId,
        assetName: assetNameMap.get(assetId) ?? 'Unknown',
        riskCount,
      }));

    return { totalRisks, byStatus, byProbability, bySeverity, highRiskAssets };
  }

  // ────────────────────────────────────────
  // RSK-011: Unified Aggregation Endpoint
  // ────────────────────────────────────────
  /**
   * Einheitlicher Endpoint für alle Aggregationsarten.
   * Wird von der Frontend-Seite RiskAggregation.tsx genutzt.
   */
  async getUnifiedAggregation(
    groupBy: 'orgUnit' | 'location' | 'assetType' | 'process' | 'service' | 'scope' | 'riskClass' | 'status' | 'assessmentType',
    filters: AggregationFilters = {},
  ): Promise<RiskAggregationGroup[]> {
    switch (groupBy) {
      case 'orgUnit': return this.aggregateByOrganizationUnit(filters);
      case 'location': return this.aggregateByLocation(filters);
      case 'assetType': return this.aggregateByAssetType(filters);
      case 'process': return this.aggregateByBusinessProcess(filters);
      case 'service': return this.aggregateByService(filters);
      case 'scope': return this.aggregateByScope(filters);
      case 'riskClass': return this.aggregateByRiskClass(filters);
      case 'status': return this.aggregateByStatus(filters);
      case 'assessmentType': return this.aggregateByAssessmentType(filters);
      default: throw new Error(`Unknown groupBy: ${groupBy}`);
    }
  }

  // ────────────────────────────────────────
  // RSK-011: Risiko-Historie über Zeit (für Trend-Analysen)
  // ────────────────────────────────────────
  /**
   * Liefert Risikozählungen pro Zeitraum-Segment für Trend-Analysen.
   * Gruppiert nach assessedAt von RiskAssessmentVersion.
   */
  async getRiskTrend(
    from: Date,
    to: Date,
    groupByPeriod: 'month' | 'quarter' | 'year' = 'month',
  ): Promise<Array<{ period: string; riskCount: number; avgInherentScore: number; avgResidualScore: number }>> {
    // Hole alle RiskAssessmentVersion im Zeitraum mit zugehörigem Risiko
    const riskAssessmentVersions = await prisma.riskAssessmentVersion.findMany({
      where: {
        assessedAt: { gte: from, lte: to },
        risk: { isArchived: false },
      } as any,
      select: {
        id: true,
        assessedAt: true,
        inherentRisk: true,
        residualRisk: true,
        likelihood: true,
        impact: true,
                riskMethodVersionId: true,
      },
    });

    // Gruppiere nach Zeitraum-Segment
    const periodMap = new Map<string, { count: number; inherentSum: number; residualSum: number }>();

    for (const a of riskAssessmentVersions) {
      let period: string;
      const d = new Date(a.assessedAt);
      if (groupByPeriod === 'month') {
        period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupByPeriod === 'quarter') {
        const q = Math.floor(d.getMonth() / 3);
        period = `${d.getFullYear()}-Q${q + 1}`;
      } else {
        period = String(d.getFullYear());
      }

      const entry = periodMap.get(period) || { count: 0, inherentSum: 0, residualSum: 0 };
      entry.count++;
      entry.inherentSum += a.likelihood * a.impact;
      entry.residualSum += (a.likelihood) * (a.impact);
      periodMap.set(period, entry);
    }

    return [...periodMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, { count, inherentSum, residualSum }]) => ({
        period,
        riskCount: count,
        avgInherentScore: Math.round((inherentSum / count) * 100) / 100,
        avgResidualScore: Math.round((residualSum / count) * 100) / 100,
      }));
  }

}

export const riskAggregationService = new RiskAggregationService();

