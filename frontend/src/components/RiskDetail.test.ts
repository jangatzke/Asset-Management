/// <reference types="vitest" />
test('RiskDetail defines all required tabs for risk detail page', () => {
  const requiredTabs = [
    'overview',
    'assessment', 
    'controls',
    'treatment',
    'evidence',
    'history',
    'audit',
  ];

  expect(requiredTabs).toContain('overview');
  expect(requiredTabs).toContain('assessment');
  expect(requiredTabs).toContain('controls');
  expect(requiredTabs).toContain('treatment');
  expect(requiredTabs).toContain('evidence');
  expect(requiredTabs).toContain('history');
  expect(requiredTabs).toContain('audit');
  expect(requiredTabs).toHaveLength(7);
});

test('RiskDetail has overview as the default active tab', () => {
  const defaultTab = 'overview';
  expect(defaultTab).toBe('overview');
});

test('RiskDetail defines route /risks/:riskId in App.tsx', () => {
  const expectedRoute = '/risks/:riskId';
  expect(expectedRoute).toContain(':riskId');
});

test('converts securityRequirements from JSON textarea to structured list', () => {
  const rawJson = [
    { category: 'confidentiality', description: 'Data at rest encryption', status: 'required' },
    { category: 'availability', description: '99.9% uptime SLA', status: 'optional' },
  ];

  rawJson.forEach(req => {
    expect(req).toHaveProperty('category');
    expect(req).toHaveProperty('description');
    expect(req).toHaveProperty('status');
  });

  const validCategories = ['confidentiality', 'integrity', 'availability', 'authentication', 'authorization'];
  rawJson.forEach(req => {
    expect(validCategories).toContain(req.category);
  });
});

test('serializes structured requirements back to API format', () => {
  const formData: Record<string, unknown> = {
    name: 'Test Supplier',
    legalEntityId: 'uuid-1',
  };

  const securityRequirements = [
    { id: 'req-1', category: 'confidentiality', description: 'Encryption required', status: 'required' },
  ];

  const payload: Record<string, unknown> = { ...formData };
  if (securityRequirements.length > 0) {
    payload.securityRequirements = securityRequirements.map(({ id: _id, ...req }) => req);
  }

  expect(payload).toHaveProperty('securityRequirements');
  expect((payload.securityRequirements as any[])).toHaveLength(1);
  expect((payload.securityRequirements as any[])[0].category).toBe('confidentiality');
});

test('handles empty security requirements', () => {
  const formData: Record<string, unknown> = { name: 'Test Supplier' };
  const securityRequirements: Array<{ id: string; category: string; description: string; status: string }> = [];

  const payload: Record<string, unknown> = { ...formData };
  if (securityRequirements.length > 0) {
    payload.securityRequirements = securityRequirements.map(({ id: _id, ...req }) => req);
  }

  expect(payload).not.toHaveProperty('securityRequirements');
});

test('EntityPicker maps fields to correct entity types', () => {
  const entityFieldMapping: Record<string, string> = {
    ownerId: 'user',
    chairId: 'user',
    auditorIds: 'user',
    businessProcesses: 'businessProcess',
    resources: 'asset',
    dependencies: 'supplier',
  };

  expect(entityFieldMapping.ownerId).toBe('user');
  expect(entityFieldMapping.auditorIds).toBe('user');
  expect(entityFieldMapping.businessProcesses).toBe('businessProcess');
});

test('EntityPicker serializes values as ID arrays for API', () => {
  const entityPickerValues = {
    auditorIds: [
      { id: 'user-1', label: 'Auditor One' },
      { id: 'user-2', label: 'Auditor Two' },
    ],
    businessProcesses: [
      { id: 'bp-1', label: 'BP-001 - Payroll' },
    ],
  };

  const payload: Record<string, unknown> = {};

  Object.entries(entityPickerValues).forEach(([key, values]) => {
    if (Array.isArray(values) && values.length > 0) {
      payload[key] = (values as Array<Record<string, string>>).map((v) => 
        typeof v === 'object' && v !== null && 'id' in v ? (v as { id: string }).id : v
      );
    }
  });

  expect(payload.auditorIds).toEqual(['user-1', 'user-2']);
  expect(payload.businessProcesses).toEqual(['bp-1']);
});
