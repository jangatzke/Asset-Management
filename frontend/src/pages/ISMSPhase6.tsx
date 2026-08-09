import { useEffect, useState, useCallback, useRef } from 'react';
import { EyeIcon } from '@heroicons/react/24/outline';
import { phase6Api } from '../services/api';
import { Modal } from '../components/Modal';
import EntityPicker from '../components/EntityPicker';
import { useI18n } from '../context/I18nContext';
import { useNavigate } from 'react-router-dom';
import { getGuidedRouteForPhase6Resource } from './ismsPhase6Routing';

// ─── Resource Metadata ───────────────────────────────────────────────────────
// Defines table columns, form fields, required fields, and capabilities per resource.

interface ResourceMeta {
  label: string;
  columns: { key: string; label: string; width?: string }[];
  fields: {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'date' | 'select' | 'number' | 'boolean' | 'json' | 'idref';
    options?: { label: string; value: string }[];
    placeholder?: string;
    required?: boolean;
  }[];
  // Which fields are required for creation
  createRequired: string[];
  // Which fields are required for update (usually none if displayId is auto-generated)
  updateRequired?: string[];
  // Which fields are required for detail view
  detailRequired?: string[];
  // Supported actions
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  canArchive?: boolean;
  // Does this resource have a due/review date field?
  hasDueDate?: boolean;
  // Due/review date field key
  dueDateField?: string;
  // Status field key
  statusField?: string;
  // Title/name field key
  titleField?: string;
}

const resourceMetas: Record<string, ResourceMeta> = {
  suppliers: {
    label: 'Suppliers',
    columns: [
      { key: 'displayId', label: 'ID', width: 'w-28' },
      { key: 'legalName', label: 'Name', width: 'w-1/4' },
      { key: 'contactPerson', label: 'Contact', width: 'w-32' },
      { key: 'criticality', label: 'Criticality', width: 'w-28' },
      { key: 'status', label: 'Status', width: 'w-24' },
      { key: 'nextReviewDate', label: 'Next Review', width: 'w-32' },
    ],
    fields: [
      { key: 'legalName', label: 'Legal Name', type: 'text', placeholder: 'Supplier GmbH', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What does the supplier provide?' },
      { key: 'contactPerson', label: 'Contact Person', type: 'text' },
      { key: 'contactEmail', label: 'Contact Email', type: 'text' },
      { key: 'contactPhone', label: 'Contact Phone', type: 'text' },
      { key: 'servicesProvided', label: 'Services Provided', type: 'textarea' },
      { key: 'criticality', label: 'Criticality', type: 'select', options: [{ label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' }, { label: 'Critical', value: 'critical' }] },
      { key: 'dataProtectionRelevant', label: 'Data Protection Relevant', type: 'boolean' },
      { key: 'nis2Relevant', label: 'NIS2 Relevant', type: 'boolean' },
      { key: 'securityRequirements', label: 'Security Requirements', type: 'json' },
      { key: 'certifications', label: 'Certifications (comma-separated)', type: 'text' },
      { key: 'exitStrategy', label: 'Exit Strategy', type: 'textarea' },
      { key: 'lastReviewDate', label: 'Last Review Date', type: 'date' },
      { key: 'nextReviewDate', label: 'Next Review Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }, { label: 'Under Review', value: 'under_review' }, { label: 'Terminated', value: 'terminated' }] },
    ],
    createRequired: ['legalName'],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canArchive: true,
    hasDueDate: true,
    dueDateField: 'nextReviewDate',
    statusField: 'status',
    titleField: 'legalName',
  },
  bias: {
    label: 'BIA',
    columns: [
      { key: 'displayId', label: 'ID', width: 'w-28' },
      { key: 'title', label: 'Title', width: 'w-1/4' },
      { key: 'status', label: 'Status', width: 'w-24' },
      { key: 'rtoMinutes', label: 'RTO', width: 'w-28' },
      { key: 'rpoMinutes', label: 'RPO', width: 'w-28' },
      { key: 'nextReviewDate', label: 'Next Review', width: 'w-32' },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: 'Business Impact Analysis Title', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'ownerId', label: 'Owner ID (User ID)', type: 'text', placeholder: 'UUID of the owner' },
      { key: 'mtpdMinutes', label: 'MTPD (minutes)', type: 'number' },
      { key: 'rtoMinutes', label: 'RTO (minutes)', type: 'number' },
      { key: 'rpoMinutes', label: 'RPO (minutes)', type: 'number' },
      { key: 'rtoImpact', label: 'RTO Impact', type: 'text' },
      { key: 'rpoImpact', label: 'RPO Impact', type: 'text' },
      { key: 'mtpdImpact', label: 'MTPD Impact', type: 'text' },
      { key: 'businessProcesses', label: 'Business Processes (comma-separated IDs)', type: 'text' },
      { key: 'resources', label: 'Resources (comma-separated IDs)', type: 'text' },
      { key: 'dependencies', label: 'Dependencies (comma-separated IDs)', type: 'text' },
      { key: 'nextReviewDate', label: 'Next Review Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Under Review', value: 'under_review' }, { label: 'Archived', value: 'archived' }] },
    ],
    createRequired: ['title', 'ownerId', 'mtpdMinutes', 'rtoMinutes', 'rpoMinutes'],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canArchive: true,
    hasDueDate: true,
    dueDateField: 'nextReviewDate',
    statusField: 'status',
    titleField: 'title',
  },
  bcps: {
    label: 'BCP',
    columns: [
      { key: 'displayId', label: 'ID', width: 'w-28' },
      { key: 'title', label: 'Title', width: 'w-1/4' },
      { key: 'status', label: 'Status', width: 'w-24' },
      { key: 'type', label: 'Type', width: 'w-28' },
      { key: 'nextTestDate', label: 'Next Test', width: 'w-32' },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: 'BCP Title', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'ownerId', label: 'Owner ID (User ID)', type: 'text', placeholder: 'UUID of the owner' },
      { key: 'type', label: 'Type', type: 'select', options: [{ label: 'Document', value: 'document' }, { label: 'Procedure', value: 'procedure' }, { label: 'Plan', value: 'plan' }] },
      { key: 'strategy', label: 'Strategy', type: 'textarea' },
      { key: 'triggerConditions', label: 'Trigger Conditions', type: 'textarea' },
      { key: 'roles', label: 'Roles (comma-separated)', type: 'text' },
      { key: 'nextTestDate', label: 'Next Test Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Under Review', value: 'under_review' }, { label: 'Archived', value: 'archived' }] },
    ],
    createRequired: ['title', 'ownerId'],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canArchive: true,
    hasDueDate: true,
    dueDateField: 'nextTestDate',
    statusField: 'status',
    titleField: 'title',
  },
  auditPlans: {
    label: 'Audits',
    columns: [
      { key: 'displayId', label: 'ID', width: 'w-28' },
      { key: 'title', label: 'Title', width: 'w-1/4' },
      { key: 'auditType', label: 'Type', width: 'w-28' },
      { key: 'status', label: 'Status', width: 'w-24' },
      { key: 'plannedStart', label: 'Start', width: 'w-32' },
      { key: 'plannedEnd', label: 'End', width: 'w-32' },
    ],
    fields: [
      { key: 'auditType', label: 'Audit Type', type: 'select', options: [{ label: 'Internal', value: 'internal' }, { label: 'External', value: 'external' }, { label: 'Combined', value: 'combined' }, { label: 'Surveillance', value: 'surveillance' }, { label: 'Certification', value: 'certification' }], required: true },
      { key: 'title', label: 'Title', type: 'text', placeholder: 'Audit Title', required: true },
      { key: 'scope', label: 'Scope', type: 'textarea', placeholder: 'What is in scope?' },
      { key: 'criteria', label: 'Criteria', type: 'textarea' },
      { key: 'plannedStart', label: 'Planned Start', type: 'date' },
      { key: 'plannedEnd', label: 'Planned End', type: 'date' },
      { key: 'auditorIds', label: 'Auditor IDs (comma-separated)', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Planned', value: 'planned' }, { label: 'In Progress', value: 'in_progress' }, { label: 'Completed', value: 'completed' }, { label: 'Cancelled', value: 'cancelled' }] },
    ],
    createRequired: ['auditType', 'title', 'scope', 'plannedStart', 'plannedEnd'],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canArchive: true,
    hasDueDate: true,
    dueDateField: 'plannedStart',
    statusField: 'status',
    titleField: 'title',
  },
  correctiveActions: {
    label: 'CAPA',
    columns: [
      { key: 'displayId', label: 'ID', width: 'w-28' },
      { key: 'title', label: 'Title', width: 'w-1/4' },
      { key: 'sourceType', label: 'Source', width: 'w-28' },
      { key: 'status', label: 'Status', width: 'w-24' },
      { key: 'dueDate', label: 'Due Date', width: 'w-32' },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: 'CAPA Title', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What needs to be done?', required: true },
      { key: 'sourceType', label: 'Source Type', type: 'select', options: [{ label: 'Audit', value: 'audit' }, { label: 'Incident', value: 'incident' }, { label: 'Risk', value: 'risk' }, { label: 'Control', value: 'control' }, { label: 'Supplier', value: 'supplier' }, { label: 'Training', value: 'training' }, { label: 'Management Review', value: 'management_review' }, { label: 'Other', value: 'other' }], required: true },
      { key: 'sourceId', label: 'Source ID', type: 'text' },
      { key: 'ownerId', label: 'Owner ID (User ID)', type: 'text', placeholder: 'UUID of the owner' },
      { key: 'dueDate', label: 'Due Date', type: 'date', required: true },
      { key: 'rootCause', label: 'Root Cause', type: 'textarea' },
      { key: 'correctiveAction', label: 'Corrective Action', type: 'textarea' },
      { key: 'preventiveAction', label: 'Preventive Action', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Open', value: 'open' }, { label: 'In Progress', value: 'in_progress' }, { label: 'Completed', value: 'completed' }, { label: 'Closed', value: 'closed' }, { label: 'Cancelled', value: 'cancelled' }] },
    ],
    createRequired: ['title', 'description', 'sourceType', 'ownerId', 'dueDate'],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canArchive: true,
    hasDueDate: true,
    dueDateField: 'dueDate',
    statusField: 'status',
    titleField: 'title',
  },
  trainingAssignments: {
    label: 'Training',
    columns: [
      { key: 'displayId', label: 'ID', width: 'w-28' },
      { key: 'courseName', label: 'Course', width: 'w-1/4' },
      { key: 'userName', label: 'Assignee', width: 'w-1/4' },
      { key: 'status', label: 'Status', width: 'w-24' },
      { key: 'dueDate', label: 'Due Date', width: 'w-32' },
    ],
    fields: [
      { key: 'courseId', label: 'Course ID', type: 'text', placeholder: 'UUID of the training course', required: true },
      { key: 'userId', label: 'User ID (Assignee)', type: 'text', placeholder: 'UUID of the user', required: true },
      { key: 'dueDate', label: 'Due Date', type: 'date', required: true },
      { key: 'assignedDate', label: 'Assigned Date', type: 'date' },
      { key: 'completedDate', label: 'Completed Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Assigned', value: 'assigned' }, { label: 'In Progress', value: 'in_progress' }, { label: 'Completed', value: 'completed' }, { label: 'Overdue', value: 'overdue' }, { label: 'Cancelled', value: 'cancelled' }] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    createRequired: ['courseId', 'userId', 'dueDate'],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canArchive: false,
    hasDueDate: true,
    dueDateField: 'dueDate',
    statusField: 'status',
    titleField: 'courseName',
  },
  managementReviews: {
    label: 'Management Reviews',
    columns: [
      { key: 'displayId', label: 'ID', width: 'w-28' },
      { key: 'title', label: 'Title', width: 'w-1/4' },
      { key: 'status', label: 'Status', width: 'w-24' },
      { key: 'reviewDate', label: 'Review Date', width: 'w-32' },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: 'Management Review Title', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'reviewDate', label: 'Review Date', type: 'date', required: true },
      { key: 'chairId', label: 'Chair ID (User ID)', type: 'text', placeholder: 'UUID of the chair', required: true },
      { key: 'agenda', label: 'Agenda', type: 'textarea' },
      { key: 'decisions', label: 'Decisions', type: 'textarea' },
      { key: 'actions', label: 'Actions', type: 'textarea' },
      { key: 'nextReviewDate', label: 'Next Review Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Planned', value: 'planned' }, { label: 'In Progress', value: 'in_progress' }, { label: 'Completed', value: 'completed' }, { label: 'Cancelled', value: 'cancelled' }] },
    ],
    createRequired: ['title', 'reviewDate', 'chairId'],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canArchive: true,
    hasDueDate: true,
    dueDateField: 'nextReviewDate',
    statusField: 'status',
    titleField: 'title',
  },
  metricDefinitions: {
    label: 'KPI/KRI',
    columns: [
      { key: 'displayId', label: 'ID', width: 'w-28' },
      { key: 'name', label: 'Name', width: 'w-1/4' },
      { key: 'status', label: 'Status', width: 'w-24' },
    ],
    fields: [
      { key: 'name', label: 'Metric Name', type: 'text', placeholder: 'KPI/KRI Name', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'ownerId', label: 'Owner ID (User ID)', type: 'text', placeholder: 'UUID of the owner' },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'targetValue', label: 'Target Value', type: 'text' },
      { key: 'thresholdLow', label: 'Threshold Low', type: 'text' },
      { key: 'thresholdMedium', label: 'Threshold Medium', type: 'text' },
      { key: 'thresholdHigh', label: 'Threshold High', type: 'text' },
      { key: 'collectionFrequency', label: 'Collection Frequency', type: 'select', options: [{ label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }, { label: 'Monthly', value: 'monthly' }, { label: 'Quarterly', value: 'quarterly' }, { label: 'Annually', value: 'annually' }] },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }, { label: 'Under Review', value: 'under_review' }] },
    ],
    createRequired: ['name', 'ownerId'],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canArchive: false,
    hasDueDate: false,
    statusField: 'status',
    titleField: 'name',
  },
  workflowInstances: {
    label: 'Workflows',
    columns: [
      { key: 'displayId', label: 'ID', width: 'w-28' },
      { key: 'entityType', label: 'Entity Type', width: 'w-1/4' },
      { key: 'currentState', label: 'State', width: 'w-1/4' },
      { key: 'status', label: 'Status', width: 'w-24' },
      { key: 'dueDate', label: 'Due Date', width: 'w-32' },
    ],
    fields: [
      { key: 'definitionId', label: 'Workflow Definition ID', type: 'text', placeholder: 'UUID of the workflow definition', required: true },
      { key: 'entityType', label: 'Entity Type', type: 'text', placeholder: 'e.g., risk, audit, incident', required: true },
      { key: 'entityId', label: 'Entity ID', type: 'text', placeholder: 'UUID of the entity', required: true },
      { key: 'currentState', label: 'Current State', type: 'text', placeholder: 'e.g., draft, in_review, approved', required: true },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Completed', value: 'completed' }, { label: 'Cancelled', value: 'cancelled' }] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    createRequired: ['definitionId', 'entityType', 'entityId', 'currentState'],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canArchive: false,
    hasDueDate: true,
    dueDateField: 'dueDate',
    statusField: 'status',
    titleField: 'entityType',
  },
  reportRuns: {
    label: 'Reports',
    columns: [
      { key: 'displayId', label: 'ID', width: 'w-28' },
      { key: 'module', label: 'Module', width: 'w-1/4' },
      { key: 'status', label: 'Status', width: 'w-24' },
    ],
    fields: [
      { key: 'module', label: 'Module', type: 'text', placeholder: 'e.g., suppliers, bias, auditPlans', required: true },
      { key: 'filter', label: 'Filter (JSON)', type: 'json' },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Pending', value: 'pending' }, { label: 'Running', value: 'running' }, { label: 'Completed', value: 'completed' }, { label: 'Failed', value: 'failed' }] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    createRequired: ['module'],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canArchive: false,
    hasDueDate: false,
    statusField: 'status',
    titleField: 'module',
  },
};

const domainGroups = [
  { key: 'supplierManagement', resources: ['suppliers'] },
  { key: 'businessContinuity', resources: ['bias', 'bcps'] },
  { key: 'auditImprovement', resources: ['auditPlans', 'correctiveActions'] },
  { key: 'awarenessTraining', resources: ['trainingAssignments'] },
  { key: 'managementReview', resources: ['managementReviews'] },
  { key: 'objectivesMetrics', resources: ['metricDefinitions'] },
  { key: 'workflowAutomation', resources: ['workflowInstances'] },
  { key: 'reportsEvidence', resources: ['reportRuns'] },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(value?: string): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('de-DE');
  } catch {
    return value;
  }
}

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'active':
    case 'planned':
    case 'assigned':
    case 'pending':
      return 'text-blue-600 dark:text-blue-400';
    case 'in_progress':
    case 'running':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'completed':
    case 'closed':
    case 'cancelled':
    case 'terminated':
    case 'archived':
    case 'overdue':
    case 'failed':
      return 'text-gray-500 dark:text-gray-400';
    default:
      return status ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400';
  }
}

const actionButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800';
const actionIconClassName = 'h-4 w-4';

// ─── Component ──────────────────────────────────────────────────────────────

const ISMSPhase6 = () => {
  const { t } = useI18n();
  const [resource, setResource] = useState('suppliers');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reminderLoading, setReminderLoading] = useState(false);

  // Pagination & filters
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [overdueFilter, setOverdueFilter] = useState(false);

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow] = useState<any>(null);
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<any>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const previousResource = useRef(resource);
  const latestRequestId = useRef(0);
  const navigate = useNavigate();

  // Form state for create/edit
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // EntityPicker selected values (separate from formData)
  const [entityPickerValues, setEntityPickerValues] = useState<Record<string, unknown[]>>({});

  // Structured security requirements for suppliers
  const [securityRequirements, setSecurityRequirements] = useState<Array<{ id: string; category: string; description: string; status: string }>>([]);

  const meta = resourceMetas[resource] || null;
  const activeDomain = domainGroups.find((group) => group.resources.includes(resource));

  // ─── Data fetching ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, limit };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (overdueFilter) params.overdue = true;
      const res = await phase6Api.list(resource, params);
      if (requestId !== latestRequestId.current) return;
      const data = res.data.data ?? res.data ?? [];
      setRows(Array.isArray(data) ? data : []);
      setTotalPages(res.data.pagination?.totalPages ?? 1);
    } catch (err: unknown) {
      if (requestId !== latestRequestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  }, [resource, page, limit, search, statusFilter, overdueFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (previousResource.current === resource) return;
    previousResource.current = resource;
    setPage(1);
  }, [resource]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleView = async (row: any) => {
    if (resource === 'auditPlans' || resource === 'correctiveActions') {
      navigate('/isms-operations/audits');
      return;
    }
    const guidedRoute = getGuidedRouteForPhase6Resource(resource);
    if (guidedRoute) {
      navigate(guidedRoute);
      return;
    }
    if (resource === 'suppliers') {
      navigate(`/isms-operations/suppliers/${row.id}`);
      return;
    }
    if (resource === 'bias' || resource === 'bcps') {
      navigate(`/isms-operations/bcm/${resource === 'bias' ? 'bia' : 'bcp'}/${row.id}`);
      return;
    }
    try {
      const res = await phase6Api.getById(resource, row.id);
      setDetailRow(res.data);
      setDetailModalOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load details');
    }
  };

  const handleSubmit = async () => {
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = { ...formData };

      // Merge EntityPicker values (array of {id, label}) into payload as arrays of IDs
      Object.entries(entityPickerValues).forEach(([key, values]) => {
        if (Array.isArray(values) && values.length > 0) {
          payload[key] = values.map((v: unknown) => {
            if (typeof v === 'object' && v !== null && 'id' in v) return (v as { id: string }).id;
            return v;
          });
        } else if (!Array.isArray(values)) {
          // Single select value
          const single = values as { id?: string } | undefined;
          if (single?.id) payload[key] = single.id;
        }
      });

      // Merge structured security requirements
      if (securityRequirements.length > 0) {
        payload.securityRequirements = securityRequirements.map(({ id: _id, ...req }) => req);
      }

      // Clean up comma-separated fields
      if (meta) {
        meta.fields.forEach((f) => {
          if (f.type === 'text' && ['businessProcesses', 'resources', 'dependencies', 'auditorIds', 'roles', 'certifications'].includes(f.key) && typeof payload[f.key] === 'string') {
            const parts = (payload[f.key] as string).split(',').map((s: string) => s.trim()).filter(Boolean);
            if (parts.length > 0) payload[f.key] = parts;
            else delete payload[f.key];
          }
          if (f.type === 'json' && typeof payload[f.key] === 'string') {
            try {
              payload[f.key] = JSON.parse(payload[f.key] as string);
            } catch {
              throw new Error(`${f.label} must contain valid JSON.`);
            }
          }
          // Remove empty strings
          if (typeof payload[f.key] === 'string' && !payload[f.key]) delete payload[f.key];
        });
      }
      // Preserve legitimate false and 0 values; omit only absent values and empty strings.
      Object.keys(payload).forEach((k) => {
        if (payload[k] === null || payload[k] === undefined || payload[k] === '') delete payload[k];
      });

      if (editRow) {
        await phase6Api.update(resource, editRow.id, payload);
      } else {
        await phase6Api.create(resource, payload);
      }
      // Close modal and refresh
      setEditModalOpen(false);
      setCreateFormOpen(false);
      setFormData({});
      if (page === 1) await fetchData();
      else setPage(1);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      await phase6Api.delete(resource, deleteRow.id);
      setDeleteModalOpen(false);
      setDeleteRow(null);
      if (page === 1) await fetchData();
      else setPage(1);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleReminders = async () => {
    setReminderLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await phase6Api.runReminders(resource);
      const data = res.data ?? {};
      setSuccess(`Generated ${data.count ?? 0} reminder${(data.count ?? 0) === 1 ? '' : 's'} for ${meta?.label ?? resource}. Automated email delivery is controlled from Admin → Reminder Automation.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run reminders');
    } finally {
      setReminderLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await phase6Api.export(resource, { format });
      const payload = res.data.payload ?? '';
      const blob = new Blob([payload], { type: res.data.mimeType ?? 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = res.data.fileName ?? `${resource}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handleFormChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFormBooleanChange = (key: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [key]: checked }));
  };

  const handleResourceSelection = (nextResource: string) => {
    const guidedRoute = getGuidedRouteForPhase6Resource(nextResource);
    if (guidedRoute) {
      navigate(guidedRoute);
      return;
    }
    setResource(nextResource);
    setPage(1);
  };

  // EntityPicker change handler
  const handleEntityPickerChange = (fieldKey: string, value: unknown, values?: unknown[]) => {
    if (values !== undefined) {
      setEntityPickerValues(prev => ({ ...prev, [fieldKey]: values }));
    } else {
      setFormData(prev => ({ ...prev, [fieldKey]: value }));
    }
  };

  // Security requirements handlers
  const addSecurityRequirement = () => {
    setSecurityRequirements(prev => [...prev, { id: crypto.randomUUID(), category: 'confidentiality', description: '', status: 'required' }]);
  };

  const removeSecurityRequirement = (id: string) => {
    setSecurityRequirements(prev => prev.filter(r => r.id !== id));
  };

  const updateSecurityRequirement = (id: string, field: string, value: string) => {
    setSecurityRequirements(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // EntityPicker config for fields that should use entity selection UI
  const getEntityPickerConfig = (fieldKey: string) => {
    const config: Record<string, { entityType: string; labelKey: string; multi?: boolean }> = {
      ownerId: { entityType: 'user', labelKey: 'ismsOperations.fields.ownerId' },
      chairId: { entityType: 'user', labelKey: 'ismsOperations.fields.chairId' },
      auditorIds: { entityType: 'user', labelKey: 'ismsOperations.fields.auditorIds', multi: true },
      businessProcesses: { entityType: 'businessProcess', labelKey: 'ismsOperations.fields.businessProcesses', multi: true },
      resources: { entityType: 'asset', labelKey: 'ismsOperations.fields.resources', multi: true },
      dependencies: { entityType: 'supplier', labelKey: 'ismsOperations.fields.dependencies', multi: true },
    };
    return config[fieldKey];
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('ismsOperations.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('ismsOperations.description')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => handleExport('json')} className="px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700">{t('common.exportJson')}</button>
          <button onClick={() => handleExport('csv')} className="px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700">{t('common.exportCsv')}</button>
          {meta?.hasDueDate && (
            <button onClick={handleReminders} disabled={reminderLoading} className="px-3 py-2 bg-orange-600 text-white rounded-md text-sm hover:bg-orange-700 disabled:opacity-50">{reminderLoading ? 'Running...' : 'Run reminders'}</button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-800 dark:text-red-200">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-semibold">{t('common.dismiss')}</button>
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-900/30 p-3 text-sm text-green-800 dark:text-green-200">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 font-semibold">{t('common.dismiss')}</button>
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold text-blue-950 dark:text-blue-100">Guided operational workflows</h2><p className="text-sm text-blue-800 dark:text-blue-200">This legacy registry is read-only. Create and change records in the guided Supplier, BCM, Audit &amp; CAPA, Training, Metrics, Management Review, Workflow, and Report workflows—never by entering identifiers or JSON.</p></div>
          <button onClick={() => navigate('/isms-operations/workspace')} className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Open workspaces</button>
        </div>
      </div>

      {/* ISMS operations domain groups */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {domainGroups.map((group) => {
          const isDomainActive = group.resources.includes(resource);
          return (
            <section
              key={group.key}
              className={`rounded-lg border p-3 bg-white dark:bg-gray-800 ${isDomainActive ? 'border-blue-300 dark:border-blue-700 shadow-sm' : 'border-gray-200 dark:border-gray-700'}`}
            >
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t(`ismsOperations.domains.${group.key}`)}
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t(`ismsOperations.domainDescriptions.${group.key}`)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.resources.map((key) => {
                  const m = resourceMetas[key];
                  return (
                    <button
                      key={key}
                       onClick={() => handleResourceSelection(key)}
                      className={`px-3 py-2 rounded-md text-sm whitespace-nowrap ${resource === key ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {activeDomain && (
        <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-sm text-blue-800 dark:text-blue-200">
          {t(`ismsOperations.domains.${activeDomain.key}`)} · {meta?.label}
        </div>
      )}

      {/* Filters bar */}
      {meta && (
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          {meta.statusField && (
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">{t('common.all')}</option>
              {meta.fields.find((f) => f.key === meta.statusField)?.options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {meta.hasDueDate && (
            <label className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={overdueFilter} onChange={(e) => { setOverdueFilter(e.target.checked); setPage(1); }} />
              Overdue only
            </label>
          )}
          <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            {rows.length} record{rows.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-500">Loading...</div>
        ) : !meta ? (
          <div className="p-6 text-gray-500">No metadata for this resource.</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-gray-500">No records are available in this legacy index. Create records through the relevant guided workflow.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {meta.columns.map((col) => (
                    <th key={col.key} className={`text-left p-3 ${col.width}`}>{col.label}</th>
                  ))}
                  <th className="p-3 w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    {meta.columns.map((col) => (
                      <td key={col.key} className={`p-3 ${col.width} ${col.key === meta?.statusField ? getStatusColor(row[col.key]) : ''}`}>
                        {col.key === 'nextReviewDate' || col.key === 'dueDate' || col.key === 'plannedStart' || col.key === 'plannedEnd' || col.key === 'reviewDate' || col.key === 'lastReviewDate' || col.key === 'nextTestDate' ? formatDate(row[col.key]) : formatCellValue(row[col.key])}
                      </td>
                    ))}
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleView(row)} aria-label={`${t('common.view')}: ${formatCellValue(row[meta.titleField || 'displayId'] ?? row.displayId ?? row.id)}`} title={t('common.view')} className={`${actionButtonClassName} text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300`}>
                          <EyeIcon aria-hidden="true" className={actionIconClassName} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm disabled:opacity-50">
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-300">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm disabled:opacity-50">
            Next
          </button>
        </div>
      )}

      {/* ─── Detail Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title={`${meta?.label || ''} Details`}>
        {detailRow && meta && (
          <div className="space-y-4">
            {meta.fields.map((f) => {
              const val = detailRow[f.key];
              if (val === undefined || val === null || val === '') return null;
              return (
                <div key={f.key}>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{f.label}</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                    {f.type === 'boolean' ? (val ? 'Yes' : 'No') : f.type === 'date' ? formatDate(val as string) : f.type === 'json' ? JSON.stringify(val, null, 2) : formatCellValue(val)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ─── Create/Edit Modal ────────────────────────────────────────────── */}
      <Modal isOpen={createFormOpen || editModalOpen} onClose={() => { setCreateFormOpen(false); setEditModalOpen(false); }} title={`${editRow ? 'Edit' : 'Add'} ${meta?.label.replace(/s$/, '')}`}>
        {meta && (() => {
          const isDisabled = false; // Future: disable form during submission etc.
          return (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {submitError && (
              <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-800 dark:text-red-200">
                {submitError}
              </div>
            )}
            {meta.fields.map((f) => {
              const value = formData[f.key];
              const required = meta.createRequired?.includes(f.key) || meta.updateRequired?.includes(f.key);
              const pickerConfig = getEntityPickerConfig(f.key);

              // Render EntityPicker for entity reference fields
              if (pickerConfig) {
                return (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      {t(pickerConfig.labelKey)} {required && <span className="text-red-500">*</span>}
                    </label>
                    <div className="mt-1">
                      <EntityPicker
                        labelKey={pickerConfig.labelKey}
                        entityType={pickerConfig.entityType as any}
                        value={value ? { id: String(value), label: String(value) } : null}
                        values={(entityPickerValues[f.key] as any[]) ?? []}
                        onChange={(v) => handleEntityPickerChange(f.key, v)}
                        onValuesChange={(vs) => setEntityPickerValues(prev => ({ ...prev, [f.key]: vs }))}
                        multiple={pickerConfig.multi}
                        required={required}
                        disabled={isDisabled}
                      />
                    </div>
                  </div>
                );
              }

              // Render structured Security Requirements UI for suppliers
              if (f.key === 'securityRequirements' && resource === 'suppliers') {
                return (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      {t('securityRequirements.title')}
                    </label>
                    <div className="mt-1 space-y-2">
                      {securityRequirements.map((req, idx) => (
                        <div key={req.id} className="p-3 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">#{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeSecurityRequirement(req.id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              {t('securityRequirements.removeRequirement')}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={req.category}
                              onChange={(e) => updateSecurityRequirement(req.id, 'category', e.target.value)}
                              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            >
                              {Object.entries(t('securityRequirements.categories') as unknown as Record<string, string>).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                            <select
                              value={req.status}
                              onChange={(e) => updateSecurityRequirement(req.id, 'status', e.target.value)}
                              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            >
                              {Object.entries(t('securityRequirements.statuses') as unknown as Record<string, string>).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </div>
                          <textarea
                            value={req.description}
                            onChange={(e) => updateSecurityRequirement(req.id, 'description', e.target.value)}
                            placeholder={t('securityRequirements.description')}
                            rows={2}
                            className="w-full mt-2 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addSecurityRequirement}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t('securityRequirements.addRequirement')}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t(f.label)} {required && <span className="text-red-500">*</span>}
                  </label>
                  <div className="mt-1">
                    {f.type === 'textarea' ? (
                      <textarea
                        value={String(value ?? '')}
                        onChange={(e) => handleFormChange(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    ) : f.type === 'select' ? (
                      <select
                        value={String(value ?? '')}
                        onChange={(e) => handleFormChange(f.key, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">-- Select --</option>
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : f.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={!!value}
                        onChange={(e) => handleFormBooleanChange(f.key, e.target.checked)}
                        className="mt-1"
                      />
                    ) : f.type === 'json' ? (
                      <textarea
                        value={String(value ?? '')}
                        onChange={(e) => handleFormChange(f.key, e.target.value)}
                        placeholder="Enter JSON..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                      />
                    ) : (
                      <input
                        type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                        value={String(value ?? '')}
                        onChange={(e) => handleFormChange(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => { setCreateFormOpen(false); setEditModalOpen(false); }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {submitLoading ? 'Saving...' : editRow ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        );
        })()}
      </Modal>

      {/* ─── Delete Confirmation Modal ────────────────────────────────────── */}
      <Modal isOpen={deleteModalOpen} onClose={() => { setDeleteModalOpen(false); setDeleteRow(null); }} title={`Delete ${meta?.label.replace(/s$/, '')}?`}>
        {deleteRow && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Are you sure you want to delete <strong>{deleteRow[meta?.titleField || 'name'] || deleteRow.id}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setDeleteModalOpen(false); setDeleteRow(null); }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={submitLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {submitLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ISMSPhase6;
