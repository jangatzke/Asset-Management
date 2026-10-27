// Canonical permission catalog shared between backend and frontend.
// This is the single source of truth for every granular permission that
// roles may carry. The backend validates role payloads against
// `GRANULAR_PERMISSIONS`; the admin UI renders the very same list grouped
// by resource so that no permission can silently disappear from the
// role editor when the backend catalog evolves.

export const GRANULAR_PERMISSIONS = [
  'assets.read', 'assets.write', 'assets.archive',
  'risks.read', 'risks.write', 'risks.assess', 'risks.approve', 'risks.accept',
  'controls.read', 'controls.write', 'controls.test', 'controls.approve',
  'incidents.read', 'incidents.write', 'incidents.assess', 'incidents.report', 'incidents.close',
  'tickets.read', 'tickets.write', 'tickets.assign', 'tickets.close', 'tickets.escalate', 'tickets.approve', 'tickets.context',
  'serviceCatalog.read', 'serviceCatalog.manage',
  'suppliers.read', 'suppliers.write', 'suppliers.approve',
  'bcm.read', 'bcm.write', 'bcm.approve',
  'audits.read', 'audits.write', 'audits.close',
  'correctiveActions.read', 'correctiveActions.write', 'correctiveActions.verify',
  'training.read', 'training.manage',
  'documents.read', 'documents.write', 'documents.approve',
  'interestedParties.read', 'interestedParties.write',
  'evidence.read', 'evidence.write', 'evidence.export',
  'nis2.read', 'nis2.write', 'nis2.approve',
  'administration.access',
] as const;

export type PermissionName = typeof GRANULAR_PERMISSIONS[number];

/**
 * Permissions grouped by resource for display in the admin role editor.
 * The groups mirror the declaration order of `GRANULAR_PERMISSIONS`, so
 * both stay in sync automatically.
 */
export const PERMISSION_GROUPS: Record<string, readonly PermissionName[]> = {
  Assets: ['assets.read', 'assets.write', 'assets.archive'],
  Risks: ['risks.read', 'risks.write', 'risks.assess', 'risks.approve', 'risks.accept'],
  Controls: ['controls.read', 'controls.write', 'controls.test', 'controls.approve'],
  Incidents: ['incidents.read', 'incidents.write', 'incidents.assess', 'incidents.report', 'incidents.close'],
  Tickets: ['tickets.read', 'tickets.write', 'tickets.assign', 'tickets.close', 'tickets.escalate', 'tickets.approve', 'tickets.context'],
  ServiceCatalog: ['serviceCatalog.read', 'serviceCatalog.manage'],
  Suppliers: ['suppliers.read', 'suppliers.write', 'suppliers.approve'],
  Bcm: ['bcm.read', 'bcm.write', 'bcm.approve'],
  Audits: ['audits.read', 'audits.write', 'audits.close'],
  CorrectiveActions: ['correctiveActions.read', 'correctiveActions.write', 'correctiveActions.verify'],
  Training: ['training.read', 'training.manage'],
  Documents: ['documents.read', 'documents.write', 'documents.approve'],
  InterestedParties: ['interestedParties.read', 'interestedParties.write'],
  Evidence: ['evidence.read', 'evidence.write', 'evidence.export'],
  Nis2: ['nis2.read', 'nis2.write', 'nis2.approve'],
  Administration: ['administration.access'],
};

/** Flattens the grouped catalog; kept in sync with GRANULAR_PERMISSIONS. */
export const ALL_PERMISSIONS: readonly PermissionName[] = Object.values(PERMISSION_GROUPS).flat();
