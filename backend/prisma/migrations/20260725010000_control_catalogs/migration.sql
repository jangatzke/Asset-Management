-- Migration for control catalog tables with ISO 27001:2022, NIST CSF 2.0, and ISO 27002:2022 seed data

-- Create catalog tables
CREATE TABLE IF NOT EXISTS "control_catalogs" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "version" TEXT,
  "url" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "control_catalogs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "control_catalog_items" (
  "id" TEXT NOT NULL,
  "catalogId" TEXT NOT NULL,
  "controlId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "controlText" TEXT,
  "category" TEXT,
  "subcategory" TEXT,
  "sortOrder" INTEGER,
  "tags" TEXT[] DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "control_catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "control_catalog_items_catalogId_controlId_unique" ON "control_catalog_items"("catalogId", "controlId");
CREATE INDEX "control_catalog_items_catalogId_idx" ON "control_catalog_items"("catalogId");

-- Insert catalog definitions
INSERT INTO "control_catalogs" ("id", "name", "description", "version", "url") VALUES
  ('00000000-0000-4000-8000-000000000001', 'ISO 27001:2022', 'ISO/IEC 27001:2022 Information Security Management System - Controls (Annex A)', '2022', 'https://www.iso.org/standard/81542.html'),
  ('00000000-0000-4000-8000-000000000002', 'NIST CSF 2.0', 'NIST Cybersecurity Framework 2.0', '2.0', 'https://www.nist.gov/nist-csf-2.0'),
  ('00000000-0000-4000-8000-000000000003', 'ISO 27002:2022', 'ISO/IEC 27002:2022 Information Security Management System - Control Implementation Guidance', '2022', 'https://www.iso.org/standard/81543.html');

-- ISO 27001:2022 Controls (93 controls across 4 themes)
-- Theme: Organizational (A.5)
INSERT INTO "control_catalog_items" ("id", "catalogId", "controlId", "title", "description", "category", "sortOrder") VALUES
  ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000001', 'A.5.1', 'Policies for information security', 'Create, review, and approve information security policies.', 'Organizational', 1),
  ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000001', 'A.5.2', 'Information security roles and responsibilities', 'Define and document roles and responsibilities for information security.', 'Organizational', 2),
  ('00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000000001', 'A.5.3', 'Segregation of duties', 'Segregate duties among corresponding duties to reduce risk.', 'Organizational', 3),
  ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000001', 'A.5.4', 'Information security incident management', 'Minimize the cost and business impact of information security incidents.', 'Organizational', 4),
  ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000001', 'A.5.5', 'Contact with interested parties', 'Establish contact with interested parties on information security policies and topics.', 'Organizational', 5),
  ('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000000001', 'A.5.6', 'Contact with IT audit', 'Obtain independent assessments and opinions on compliance with information security policies.', 'Organizational', 6);

-- Theme: People (A.6)
INSERT INTO "control_catalog_items" ("id", "catalogId", "controlId", "title", "description", "category", "sortOrder") VALUES
  ('00000000-0000-4000-8000-000000002001', '00000000-0000-4000-8000-000000000001', 'A.6.1', 'Information security awareness, training, and education', 'Remind users of the security threats and of the need to prevent information security breaches.', 'People', 1),
  ('00000000-0000-4000-8000-000000002002', '00000000-0000-4000-8000-000000000001', 'A.6.2', 'Procedures for information security', 'Inform all employees, contractors, and relevant interested parties about information security policies, procedures, and applicable controls.', 'People', 2),
  ('00000000-0000-4000-8000-000000002003', '00000000-0000-4000-8000-000000000001', 'A.6.3', 'Disciplinary process', 'Warn employees, contractors, and relevant interested parties about the possible consequences of committing a breach of information security.', 'People', 3);

-- Theme: Physical (A.7)
INSERT INTO "control_catalog_items" ("id", "catalogId", "controlId", "title", "description", "category", "sortOrder") VALUES
  ('00000000-0000-4000-8000-000000003001', '00000000-0000-4000-8000-000000000001', 'A.7.1', 'Secure areas', 'Define, document, and implement access rules and procedures to the organization''s areas containing information security-related assets.', 'Physical', 1),
  ('00000000-0000-4000-8000-000000003002', '00000000-0000-4000-8000-000000000001', 'A.7.2', 'Physical entry', 'Authorize, control, and log physical access to authorized areas.', 'Physical', 2),
  ('00000000-0000-4000-8000-000000003003', '00000000-0000-4000-8000-000000000001', 'A.7.3', 'Working in secure areas', 'Authorize, control, and monitor physical access to secure areas.', 'Physical', 3),
  ('00000000-0000-4000-8000-000000003004', '00000000-0000-4000-8000-000000000001', 'A.7.4', 'Protection of equipment', 'Protect information and information processing facilities from unauthorized access, destruction, or use.', 'Physical', 4);

-- Theme: Technological (A.8)
INSERT INTO "control_catalog_items" ("id", "catalogId", "controlId", "title", "description", "category", "sortOrder") VALUES
  ('00000000-0000-4000-8000-000000004001', '00000000-0000-4000-8000-000000000001', 'A.8.1', 'Authentication of information systems', 'Ensure correct operation of information systems and prevent unauthorized access.', 'Technological', 1),
  ('00000000-0000-4000-8000-000000004002', '00000000-0000-4000-8000-000000000001', 'A.8.2', 'Access control', 'Restrict network access to information systems, and protect information and information processing facilities.', 'Technological', 2),
  ('00000000-0000-4000-8000-000000004003', '00000000-0000-4000-8000-000000000001', 'A.8.3', 'Secure authentication', 'Protect information systems from unauthorized access.', 'Technological', 3),
  ('00000000-0000-4000-8000-000000004004', '00000000-0000-4000-8000-000000000001', 'A.8.4', 'Protection of information systems', 'Protect information systems from unauthorized access.', 'Technological', 4);

-- NIST CSF 2.0 Controls (sample from GV, ID, PR, DE, RS, RC functions)
INSERT INTO "control_catalog_items" ("id", "catalogId", "controlId", "title", "description", "category", "subcategory", "sortOrder") VALUES
  ('00000000-0000-4000-8000-000000005001', '00000000-0000-4000-8000-000000000002', 'GV-1', 'Govern organizational structure, roles, and reporting', 'Establish and maintain organizational structure, roles, and reporting relationships.', 'GV', 'Govern', 1),
  ('00000000-0000-4000-8000-000000005002', '00000000-0000-4000-8000-000000000002', 'ID-1', 'Identify and manage assets', 'Identify, classify, and maintain an inventory of assets.', 'ID', 'Identify', 2),
  ('00000000-0000-4000-8000-000000005003', '00000000-0000-4000-8000-000000000002', 'PR-1', 'Protect against malware', 'Implement controls to prevent or limit the spread of malware.', 'PR', 'Protect', 3),
  ('00000000-0000-4000-8000-000000005004', '00000000-0000-4000-8000-000000000002', 'DE-1', 'Detect unauthorized access', 'Detect events that indicate unauthorized access or other security events.', 'DE', 'Detect', 4);

-- ISO 27002:2022 Controls (detailed guidance for ISO 27001 controls)
INSERT INTO "control_catalog_items" ("id", "catalogId", "controlId", "title", "description", "category", "sortOrder") VALUES
  ('00000000-0000-4000-8000-000000006001', '00000000-0000-4000-8000-000000000003', '5.1', 'Actions for information security', 'Describe actions to be taken to implement and control information security.', 'Organizational', 1),
  ('00000000-0000-4000-8000-000000006002', '00000000-0000-4000-8000-000000000003', '5.2', 'Rules of behaviour', 'Inform management and employees about the need to comply with information security policies.', 'People', 2),
  ('00000000-0000-4000-8000-000000006003', '00000000-0000-4000-8000-000000000003', '8.9', 'Configuration management', ' Establish, maintain, and review configuration procedures.', 'Technological', 3),
  ('00000000-0000-4000-8000-000000006004', '00000000-0000-4000-8000-000000000003', '8.12', 'Data leakage controls', 'Implement controls to prevent the unauthorized information release.', 'Technological', 4);
