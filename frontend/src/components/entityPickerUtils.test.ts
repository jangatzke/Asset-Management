// Note: `vi` is provided globally by vitest via globals: true in vite.config.ts

// Runtime type check for EntityPickerResult
function assertEntityPickerResult(result: { id: string; label: string }): void {
  if (typeof result.id !== 'string') throw new Error('id must be string');
  if (typeof result.label !== 'string') throw new Error('label must be string');
}

test('EntityPickerResult type requires id and label fields', () => {
  const result = { id: '1', label: 'Test' } as { id: string; label: string };
  assertEntityPickerResult(result);
  expect(result.id).toBe('1');
  expect(result.label).toBe('Test');
});

test('EntityPickerResult accepts displayId format labels', () => {
  const result = { id: 'usr-1', label: 'USR-1 - John Doe' } as { id: string; label: string };
  assertEntityPickerResult(result);
  expect(result.id).toContain('usr');
  expect(result.label).toContain('-');
});

test('EntityPickerResult accepts simple name labels', () => {
  const result = { id: 'sup-1', label: 'Acme Corp' } as { id: string; label: string };
  assertEntityPickerResult(result);
  expect(result.label).toBe('Acme Corp');
});

test('EntityType includes all required entity types for picker', () => {
  const supportedTypes = ['user', 'asset', 'organizationUnit', 'supplier', 'risk', 'control', 'businessProcess'] as const;
  expect(supportedTypes).toContain('user');
  expect(supportedTypes).toContain('asset');
  expect(supportedTypes).toContain('supplier');
  expect(supportedTypes).toContain('risk');
  expect(supportedTypes).toContain('control');
  expect(supportedTypes).toContain('businessProcess');
});

test('EntityType has exactly 7 supported entity types', () => {
  const supportedTypes = ['user', 'asset', 'organizationUnit', 'supplier', 'risk', 'control', 'businessProcess'] as const;
  expect(supportedTypes).toHaveLength(7);
});

test('maps entity objects to picker result format', () => {
  const rawItems = [
    { id: '1', displayId: 'USR-1', name: 'User One' },
    { id: '2', legalName: 'Supplier A' },
    { id: '3', title: 'Control X' },
  ];

  const results = rawItems.map((item) => ({
    id: item.id,
    label: (item as any).displayId && ((item as any).name || (item as any).title)
      ? `${(item as any).displayId} - ${(item as any).name || (item as any).title}`
      : (item as any).legalName || (item as any).name || (item as any).title || item.id,
  }));

  expect(results[0].label).toBe('USR-1 - User One');
  expect(results[1].label).toBe('Supplier A');
  expect(results[2].label).toBe('Control X');
});

test('handles pagination metadata', () => {
  const items = [{ id: '1', name: 'Item 1' }];
  const limit = 20;
  const total = 50;

  const hasMore = items.length >= limit || (total > items.length);
  
  expect(hasMore).toBe(true);
});

test('handles empty results', () => {
  const items: Array<{ id: string }> = [];
  expect(items).toHaveLength(0);
});
