// Common types used across the application

export interface BaseEntity {
  id: string;
  displayId?: string;
  status: string;
  version: string;
  ownerId: string;
  organizationUnitId?: string;
  scopeId?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  isArchived: boolean;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'critical';

export type ImplementationStatus = 'not_started' | 'in_progress' | 'completed' | 'not_applicable';

export type MaturityLevel = 0 | 1 | 2 | 3 | 4 | 5;
