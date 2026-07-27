/**
 * Shared status color helpers for risk and control UI components.
 * Extracted from Risks.tsx, Controls.tsx, ISMSPhase6.tsx to reduce duplication.
 */

export type RiskLevel = 'very_high' | 'high' | 'medium' | 'low' | string;
export type ControlStatus = 'implemented' | 'planned' | 'in_progress' | 'under_review' | string;

/** Tailwind classes for risk level badges. */
export const getRiskColor = (riskLevel: RiskLevel): string => {
  switch (riskLevel?.toLowerCase()) {
    case 'very_high': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
    case 'high': return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200';
    case 'medium': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    case 'low': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
  }
};

/** Tailwind classes for control implementation status badges. */
export const getControlStatusColor = (status: ControlStatus): string => {
  switch (status?.toLowerCase()) {
    case 'implemented': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
    case 'planned': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
    case 'in_progress': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    case 'under_review': return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
  }
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
