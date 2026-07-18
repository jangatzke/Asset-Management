// Request/Response DTOs with Zod schemas for API validation
// Centralized in shared/ for consistency between frontend and backend

import { z } from 'zod';

// ==========================================
// Common DTOs
// ==========================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const IdParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export type IdParam = z.infer<typeof IdParamSchema>;

// ==========================================
// Auth DTOs
// ==========================================

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

export type RegisterDTO = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDTO = z.infer<typeof LoginSchema>;

export const CreateFirstAdminSchema = RegisterSchema.extend({
  // Same fields as register, but semantically distinct
});

export type CreateFirstAdminDTO = z.infer<typeof CreateFirstAdminSchema>;

// ==========================================
// Asset DTOs
// ==========================================

export const CreateAssetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  assetType: z.string().min(1, 'Asset type is required'),
  subType: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  externalId: z.string().optional(),
  organizationUnitId: z.string().optional(),
  locationId: z.string().optional(),
  technicalOperatorId: z.string().optional(),
  businessOwnerId: z.string().optional(),
  informationSecurityResponsibleId: z.string().optional(),
  businessProcessId: z.string().optional(),
  serviceId: z.string().optional(),
  contractId: z.string().optional(),
  licenseId: z.string().optional(),
  personnelSafetyRelevance: z.enum(['low', 'medium', 'high']).default('low'),
  regulatoryRelevance: z.enum(['low', 'medium', 'high']).default('low'),
  financialDamagePotential: z.enum(['low', 'medium', 'high']).default('low'),
  productionDowntimeImpact: z.enum(['low', 'medium', 'high']).default('low'),
  lifecycleStatus: z.string().default('planned'),
  confidentialityNeed: z.enum(['low', 'medium', 'high']).default('low'),
  integrityNeed: z.enum(['low', 'medium', 'high']).default('low'),
  availabilityNeed: z.enum(['low', 'medium', 'high']).default('low'),
  dataProtectionRelevance: z.boolean().default(false),
  criticality: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  networkAddresses: z.string().optional(),
  dnsNames: z.string().optional(),
});

export type CreateAssetDTO = z.infer<typeof CreateAssetSchema>;

export const UpdateAssetSchema = CreateAssetSchema.partial();

export type UpdateAssetDTO = z.infer<typeof UpdateAssetSchema>;

// ==========================================
// Risk DTOs
// ==========================================

export const CreateRiskSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  likelihood: z.enum(['low', 'medium', 'high']).default('medium'),
  impact: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.string().default('identified'),
});

export type CreateRiskDTO = z.infer<typeof CreateRiskSchema>;

export const UpdateRiskSchema = CreateRiskSchema.partial();

export type UpdateRiskDTO = z.infer<typeof UpdateRiskSchema>;

// ==========================================
// Control DTOs
// ==========================================

export const CreateControlSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  controlType: z.string().optional(),
  implementationStatus: z.enum(['not_started', 'in_progress', 'completed', 'not_applicable']).default('not_started'),
});

export type CreateControlDTO = z.infer<typeof CreateControlSchema>;

// ==========================================
// Incident DTOs
// ==========================================

export const CreateIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  status: z.string().default('reported'),
});

export type CreateIncidentDTO = z.infer<typeof CreateIncidentSchema>;

// ==========================================
// Contract DTOs
// ==========================================

export const CreateContractSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  contractType: z.string().min(1, 'Contract type is required'),
  supplierId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  renewalDate: z.coerce.date().optional(),
  value: z.number().positive().optional(),
  currency: z.string().optional(),
  status: z.string().default('active'),
});

export type CreateContractDTO = z.infer<typeof CreateContractSchema>;

// ==========================================
// License DTOs
// ==========================================

export const CreateLicenseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  licenseType: z.string().min(1, 'License type is required'),
  vendor: z.string().optional(),
  productId: z.string().optional(),
  licenseKey: z.string().optional(),
  seats: z.number().int().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  renewalDate: z.coerce.date().optional(),
  cost: z.number().positive().optional(),
  currency: z.string().optional(),
  status: z.string().default('active'),
});

export type CreateLicenseDTO = z.infer<typeof CreateLicenseSchema>;

// ==========================================
// Business Process DTOs
// ==========================================

export const CreateBusinessProcessSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  processOwner: z.string().min(1, 'Process owner is required'),
  category: z.enum(['core', 'supporting', 'management']).optional(),
  siacControlled: z.boolean().default(false),
  criticality: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.string().default('active'),
});

export type CreateBusinessProcessDTO = z.infer<typeof CreateBusinessProcessSchema>;

// ==========================================
// Risk Treatment DTOs
// ==========================================

export const CreateRiskTreatmentSchema = z.object({
  riskId: z.string().uuid(),
  treatmentType: z.enum(['mitigate', 'transfer', 'accept', 'avoid']),
  description: z.string().min(1, 'Description is required'),
  responsibleUserId: z.string().uuid(),
  plannedCompletionDate: z.coerce.date().optional(),
  budget: z.number().positive().optional(),
});

export type CreateRiskTreatmentDTO = z.infer<typeof CreateRiskTreatmentSchema>;

// ==========================================
// Risk Method DTOs
// ==========================================

export const CreateRiskMethodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  matrixRows: z.number().int().positive(),
  matrixColumns: z.number().int().positive(),
  scores: z.array(z.number()),
});

export type CreateRiskMethodDTO = z.infer<typeof CreateRiskMethodSchema>;

// ==========================================
// User Preferences DTOs
// ==========================================

export const UpdatePreferencesSchema = z.object({
  language: z.enum(['en', 'de']).optional(),
  darkMode: z.boolean().optional(),
});

export type UpdatePreferencesDTO = z.infer<typeof UpdatePreferencesSchema>;
