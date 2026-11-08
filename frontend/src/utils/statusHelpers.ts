/**
 * Shared status color helpers for risk and control UI components.
 * Extracted from Risks.tsx, Controls.tsx, ISMSPhase6.tsx to reduce duplication.
 * The severity/traffic-light class maps themselves live in `styles/severity.ts`
 * (documented design intention — see the module header there).
 */

import { RISK_LEVEL_TONE, CONTROL_STATUS_TONE, NEUTRAL_BADGE_TONE } from '../styles/severity';

export type RiskLevel = 'very_high' | 'high' | 'medium' | 'low' | string;
export type ControlStatus = 'implemented' | 'planned' | 'in_progress' | 'under_review' | string;

/**
 * Semantic status kinds (Stage 2 / QW-3). These map to the mode-switchable
 * Tailwind utilities `bg-status-<kind>-bg` + `text-status-<kind>-fg` defined
 * via design-tokens.json — no `dark:` variants are needed.
 */
export type StatusKind = 'critical' | 'warn' | 'ok' | 'info' | 'idle';

/**
 * Central badge mapping: semantic status kind -> Tailwind classes for a badge
 * (background + foreground). Used by Dashboard, Contracts, Licenses, Processes,
 * Incidents and ActionCenter instead of per-page raw-palette color maps.
 */
export const statusBadgeClass = (kind: StatusKind): string => {
  switch (kind) {
    case 'critical': return 'bg-status-critical-bg text-status-critical-fg';
    case 'warn': return 'bg-status-warn-bg text-status-warn-fg';
    case 'ok': return 'bg-status-ok-bg text-status-ok-fg';
    case 'info': return 'bg-status-info-bg text-status-info-fg';
    default: return 'bg-status-idle-bg text-status-idle-fg';
  }
};

/** Tailwind classes for risk level badges. */
export const getRiskColor = (riskLevel: RiskLevel): string => {
  return RISK_LEVEL_TONE[riskLevel?.toLowerCase() as keyof typeof RISK_LEVEL_TONE] ?? NEUTRAL_BADGE_TONE;
};

/** Tailwind classes for control implementation status badges. */
export const getControlStatusColor = (status: ControlStatus): string => {
  return CONTROL_STATUS_TONE[status?.toLowerCase() as keyof typeof CONTROL_STATUS_TONE] ?? NEUTRAL_BADGE_TONE;
};

/** Unified status color getter that auto-detects risk vs control. */
export const getStatusColor = (status: string, type?: 'risk' | 'control'): string => {
  if (type === 'control') return getControlStatusColor(status);
  // Auto-detect based on known values
  if (['implemented', 'planned', 'in_progress', 'under_review'].includes(status.toLowerCase())) {
    return getControlStatusColor(status);
  }
  return getRiskColor(status);
};

/** Extract error message from axios-like error objects. */
export const getErrorMessage = (err: unknown): string | undefined => {
  if (!err || typeof err !== 'object') return undefined;
  const response = (err as Record<string, unknown>).response as { data?: { error?: { message?: string } } } | undefined;
  return response?.data?.error?.message;
};
