// Organization types

import { BaseEntity } from './common';

export interface LegalEntity extends BaseEntity {
  name: string;
  legalForm: string;
  registrationNumber?: string;
  taxId?: string;
  address?: string;
  country: string;
}

export interface OrganizationUnit extends BaseEntity {
  name: string;
  description?: string;
  parentId?: string;
  type: 'company' | 'location' | 'department' | 'team' | 'other';
  legalEntityId?: string;
  responsibleId?: string;
}

export interface Site extends BaseEntity {
  name: string;
  address: string;
  city: string;
  postalCode?: string;
  country: string;
  organizationUnitId?: string;
  isCritical: boolean;
}

export interface IsmsScope extends BaseEntity {
  name: string;
  description: string;
  includedCompanies: string[];
  includedLocations: string[];
  includedBusinessProcesses: string[];
  includedServices: string[];
  includedAssets: string[];
  explicitExclusions: string[];
  exclusionJustifications: Record<string, string>;
  responsibleId: string;
  approvalStatus: 'draft' | 'under_review' | 'approved' | 'superseded';
  validFrom: Date;
  validUntil?: Date;
  nextReviewDate: Date;
}

export interface InterestedParty extends BaseEntity {
  name: string;
  type: 'customer' | 'owner' | 'employee' | 'authority' | 'insurer' | 'supplier' | 'works_council' | 'certification_body' | 'other';
  requirements?: string[];
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface ContextAnalysis extends BaseEntity {
  internalIssues: string[];
  externalIssues: string[];
  climateRelevanceAssessment: 'relevant' | 'not_relevant' | 'under_review';
  climateRelevanceJustification?: string;
  climateRelatedRequirements?: string[];
  lastReviewDate: Date;
  nextReviewDate: Date;
}
