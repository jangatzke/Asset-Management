-- User-reference integrity for the ISMS/document/governance domain (F-01/F-14)
--
-- Every user-id column below already exists from the consolidated baseline; this
-- migration turns them into real foreign keys on "users"("id"), repairs orphaned
-- references BEFORE the constraints are added, and adds the FK indexes that the
-- new Prisma relations declare.
--
-- Semantics per field kind:
--   * nullable references  -> orphan/inactive rows are cleared (ON DELETE SET NULL)
--   * required references  -> orphan/inactive rows are reassigned to an active
--                             system_admin user (ON DELETE RESTRICT, cannot be NULL).
--                             If no fallback user exists the reassignment is skipped
--                             and the guarded FK creation below fails explicitly when
--                             dangling ids are present.
--
-- Deliberately NOT constrained: risk_acceptances."requestedBy". The treatment service
-- stores a literal 'system' sentinel there when no requesting user is available, so a
-- FK would break a legitimate write path. It stays a String reference.
--
-- All statements are re-runnable: remediation is idempotent, constraints are guarded
-- by pg_constraint checks and indexes use IF NOT EXISTS.

-- ---------------------------------------------------------------------------
-- Step 1: Data quality remediation (must run before the FK constraints)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  fallback_user TEXT;
  i             INTEGER;

  -- Columns that are allowed to become NULL.
  nullable_tables TEXT[] := ARRAY[
    'documents', 'documents', 'documents',
    'policy_documents', 'policy_documents',
    'document_versions', 'document_versions',
    'statements_of_applicability', 'statements_of_applicability', 'statements_of_applicability',
    'risk_treatments', 'risk_treatments',
    'treatment_actions',
    'risk_acceptances',
    'business_continuity_plans',
    'audit_plans',
    'audit_findings',
    'training_assignments',
    'management_reviews',
    'ticket_comments'
  ];
  nullable_columns TEXT[] := ARRAY[
    'ownerId', 'reviewerId', 'approverId',
    'reviewerId', 'approverId',
    'reviewerId', 'approverId',
    'submittedBy', 'approvedBy', 'rejectedBy',
    'responsibleUserId', 'approvedByUserId',
    'responsibleUserId',
    'approvedBy',
    'approvedBy',
    'approvedBy',
    'ownerId',
    'assignedBy',
    'approvedBy',
    'authorId'
  ];

  -- Columns that must reference a user but cannot be NULL.
  required_tables TEXT[] := ARRAY[
    'policy_documents', 'document_versions', 'document_acknowledgements', 'document_reviews',
    'soa_approvals',
    'risk_assessment_versions', 'risk_control_assessments',
    'risk_treatment_approvals', 'risk_treatment_effectiveness_reviews',
    'business_impact_analyses', 'business_continuity_plans',
    'audit_programs', 'corrective_actions',
    'training_courses', 'training_assignments', 'training_completions', 'training_acknowledgements',
    'management_reviews', 'management_review_actions',
    'security_objectives', 'metric_definitions'
  ];
  required_columns TEXT[] := ARRAY[
    'ownerId', 'authorId', 'userId', 'reviewerId',
    'approverId',
    'assessorId', 'assessedBy',
    'approverId', 'reviewerId',
    'ownerId', 'ownerId',
    'ownerId', 'ownerId',
    'ownerId', 'userId', 'userId', 'userId',
    'chairId', 'ownerId',
    'ownerId', 'ownerId'
  ];
BEGIN
  -- First active system admin (ascending e-mail for deterministic choice).
  SELECT u."id" INTO fallback_user
  FROM "users" u
  JOIN "user_roles" ur ON ur."userId" = u."id"
  JOIN "roles" ro ON ro."id" = ur."roleId"
  WHERE u."isActive" = TRUE AND ro."name" = 'system_admin'
  ORDER BY u."email" ASC
  LIMIT 1;

  -- Nullable references: dangling/inactive ids are cleared.
  FOR i IN 1..array_length(nullable_tables, 1) LOOP
    EXECUTE format(
      'UPDATE %I SET %I = NULL WHERE %I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = %I.%I AND u."isActive" = TRUE)',
      nullable_tables[i], nullable_columns[i], nullable_columns[i], nullable_tables[i], nullable_columns[i]
    );
  END LOOP;

  -- Required references: reassign to the fallback admin when one exists.
  IF fallback_user IS NOT NULL THEN
    FOR i IN 1..array_length(required_tables, 1) LOOP
      EXECUTE format(
        'UPDATE %I SET %I = %L WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = %I.%I AND u."isActive" = TRUE)',
        required_tables[i], required_columns[i], fallback_user, required_tables[i], required_columns[i]
      );
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 2: Foreign key constraints (guarded for re-runnability)
-- ---------------------------------------------------------------------------
-- Format per entry: <table>|<constraint name>|<column>|<ON DELETE action>

DO $$
DECLARE
  entry   TEXT;
  parts   TEXT[];
  v_table TEXT;
  v_name  TEXT;
  v_col   TEXT;
  v_action TEXT;
  entries TEXT[] := ARRAY[
    -- Nullable references (SetNull)
    'documents|fk_documents_owner|ownerId|SET NULL',
    'documents|fk_documents_reviewer|reviewerId|SET NULL',
    'documents|fk_documents_approver|approverId|SET NULL',
    'policy_documents|fk_policy_documents_reviewer|reviewerId|SET NULL',
    'policy_documents|fk_policy_documents_approver|approverId|SET NULL',
    'document_versions|fk_document_versions_reviewer|reviewerId|SET NULL',
    'document_versions|fk_document_versions_approver|approverId|SET NULL',
    'statements_of_applicability|fk_statement_of_applicability_submitted_by|submittedBy|SET NULL',
    'statements_of_applicability|fk_statement_of_applicability_approved_by|approvedBy|SET NULL',
    'statements_of_applicability|fk_statement_of_applicability_rejected_by|rejectedBy|SET NULL',
    'risk_treatments|fk_risk_treatments_responsible_user|responsibleUserId|SET NULL',
    'risk_treatments|fk_risk_treatments_approved_by|approvedByUserId|SET NULL',
    'treatment_actions|fk_treatment_actions_responsible_user|responsibleUserId|SET NULL',
    'risk_acceptances|fk_risk_acceptances_approved_by|approvedBy|SET NULL',
    'business_continuity_plans|fk_business_continuity_plans_approved_by|approvedBy|SET NULL',
    'audit_plans|fk_audit_plans_approved_by|approvedBy|SET NULL',
    'audit_findings|fk_audit_findings_owner|ownerId|SET NULL',
    'training_assignments|fk_training_assignments_assigned_by|assignedBy|SET NULL',
    'management_reviews|fk_management_reviews_approved_by|approvedBy|SET NULL',
    'ticket_comments|fk_ticket_comments_author|authorId|SET NULL',

    -- Required references (Restrict)
    'policy_documents|fk_policy_documents_owner|ownerId|RESTRICT',
    'document_versions|fk_document_versions_author|authorId|RESTRICT',
    'document_acknowledgements|fk_document_acknowledgements_user|userId|RESTRICT',
    'document_reviews|fk_document_reviews_reviewer|reviewerId|RESTRICT',
    'soa_approvals|fk_soa_approvals_approver|approverId|RESTRICT',
    'risk_assessment_versions|fk_risk_assessment_versions_assessor|assessorId|RESTRICT',
    'risk_control_assessments|fk_risk_control_assessments_assessor|assessedBy|RESTRICT',
    'risk_treatment_approvals|fk_risk_treatment_approvals_approver|approverId|RESTRICT',
    'risk_treatment_effectiveness_reviews|fk_risk_treatment_effectiveness_reviews_reviewer|reviewerId|RESTRICT',
    'business_impact_analyses|fk_business_impact_analyses_owner|ownerId|RESTRICT',
    'business_continuity_plans|fk_business_continuity_plans_owner|ownerId|RESTRICT',
    'audit_programs|fk_audit_programs_owner|ownerId|RESTRICT',
    'corrective_actions|fk_corrective_actions_owner|ownerId|RESTRICT',
    'training_courses|fk_training_courses_owner|ownerId|RESTRICT',
    'training_assignments|fk_training_assignments_user|userId|RESTRICT',
    'training_completions|fk_training_completions_user|userId|RESTRICT',
    'training_acknowledgements|fk_training_acknowledgements_user|userId|RESTRICT',
    'management_reviews|fk_management_reviews_chair|chairId|RESTRICT',
    'management_review_actions|fk_management_review_actions_owner|ownerId|RESTRICT',
    'security_objectives|fk_security_objectives_owner|ownerId|RESTRICT',
    'metric_definitions|fk_metric_definitions_owner|ownerId|RESTRICT'
  ];
BEGIN
  FOREACH entry IN ARRAY entries LOOP
    parts := string_to_array(entry, '|');
    v_table := parts[1];
    v_name := parts[2];
    v_col := parts[3];
    v_action := parts[4];

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = v_name) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES "users"("id") ON DELETE %s ON UPDATE CASCADE',
        v_table, v_name, v_col, v_action
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Step 3: FK indexes (hot-path owner/approver filters and authorization joins)
-- ---------------------------------------------------------------------------
-- Only columns without an existing index are listed here; approver/reviewer/user
-- indexes that already exist from earlier migrations are intentionally skipped.

CREATE INDEX IF NOT EXISTS "documents_ownerid_idx" ON "documents" ("ownerId");
CREATE INDEX IF NOT EXISTS "documents_reviewerid_idx" ON "documents" ("reviewerId");
CREATE INDEX IF NOT EXISTS "documents_approverid_idx" ON "documents" ("approverId");

CREATE INDEX IF NOT EXISTS "policy_documents_ownerid_idx" ON "policy_documents" ("ownerId");
CREATE INDEX IF NOT EXISTS "policy_documents_reviewerid_idx" ON "policy_documents" ("reviewerId");
CREATE INDEX IF NOT EXISTS "policy_documents_approverid_idx" ON "policy_documents" ("approverId");

CREATE INDEX IF NOT EXISTS "document_versions_authorid_idx" ON "document_versions" ("authorId");
CREATE INDEX IF NOT EXISTS "document_versions_reviewerid_idx" ON "document_versions" ("reviewerId");
CREATE INDEX IF NOT EXISTS "document_versions_approverid_idx" ON "document_versions" ("approverId");

CREATE INDEX IF NOT EXISTS "document_reviews_reviewerid_idx" ON "document_reviews" ("reviewerId");

CREATE INDEX IF NOT EXISTS "statements_of_applicability_submittedby_idx" ON "statements_of_applicability" ("submittedBy");
CREATE INDEX IF NOT EXISTS "statements_of_applicability_approvedby_idx" ON "statements_of_applicability" ("approvedBy");
CREATE INDEX IF NOT EXISTS "statements_of_applicability_rejectedby_idx" ON "statements_of_applicability" ("rejectedBy");

CREATE INDEX IF NOT EXISTS "soa_approvals_approverid_idx" ON "soa_approvals" ("approverId");

CREATE INDEX IF NOT EXISTS "risk_assessment_versions_assessorid_idx" ON "risk_assessment_versions" ("assessorId");
CREATE INDEX IF NOT EXISTS "risk_control_assessments_assessedby_idx" ON "risk_control_assessments" ("assessedBy");
CREATE INDEX IF NOT EXISTS "risk_treatments_responsibleuserid_idx" ON "risk_treatments" ("responsibleUserId");
CREATE INDEX IF NOT EXISTS "risk_treatments_approvedbyuserid_idx" ON "risk_treatments" ("approvedByUserId");
CREATE INDEX IF NOT EXISTS "treatment_actions_responsibleuserid_idx" ON "treatment_actions" ("responsibleUserId");
CREATE INDEX IF NOT EXISTS "risk_acceptances_approvedby_idx" ON "risk_acceptances" ("approvedBy");

CREATE INDEX IF NOT EXISTS "business_impact_analyses_ownerid_idx" ON "business_impact_analyses" ("ownerId");
CREATE INDEX IF NOT EXISTS "business_continuity_plans_ownerid_idx" ON "business_continuity_plans" ("ownerId");
CREATE INDEX IF NOT EXISTS "business_continuity_plans_approvedby_idx" ON "business_continuity_plans" ("approvedBy");

CREATE INDEX IF NOT EXISTS "audit_programs_ownerid_idx" ON "audit_programs" ("ownerId");
CREATE INDEX IF NOT EXISTS "audit_plans_approvedby_idx" ON "audit_plans" ("approvedBy");
CREATE INDEX IF NOT EXISTS "audit_findings_ownerid_idx" ON "audit_findings" ("ownerId");

CREATE INDEX IF NOT EXISTS "corrective_actions_ownerid_idx" ON "corrective_actions" ("ownerId");
CREATE INDEX IF NOT EXISTS "training_courses_ownerid_idx" ON "training_courses" ("ownerId");
CREATE INDEX IF NOT EXISTS "training_assignments_assignedby_idx" ON "training_assignments" ("assignedBy");

CREATE INDEX IF NOT EXISTS "management_reviews_chairid_idx" ON "management_reviews" ("chairId");
CREATE INDEX IF NOT EXISTS "management_reviews_approvedby_idx" ON "management_reviews" ("approvedBy");
CREATE INDEX IF NOT EXISTS "management_review_actions_ownerid_idx" ON "management_review_actions" ("ownerId");

CREATE INDEX IF NOT EXISTS "metric_definitions_ownerid_idx" ON "metric_definitions" ("ownerId");

CREATE INDEX IF NOT EXISTS "ticket_comments_authorid_idx" ON "ticket_comments" ("authorId");
