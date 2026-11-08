/**
 * EntityPicker component tests.
 *
 * Proves:
 *  - the picker renders a readable label and can search entities (debounced)
 *  - selecting an option calls onChange / onValuesChange with the entity id
 *  - the clear button is only rendered for clearable single-select values and
 *    invokes onClear so nullable references can be reset
 *  - inactive users returned by the API are filtered out of the options list
 *    and labels are human-readable (name + e-mail, never a raw UUID)
 *
 * The `./api` module is mocked (not `entityPickerApi`) so the real adapter
 * runs: endpoint selection, inactive filtering and label formatting are all
 * exercised through the component.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

declare const vi: typeof import('vitest').vi;

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('../context/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key, language: 'en', setLanguage: vi.fn() }),
}));

vi.mock('../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

import EntityPicker from './EntityPicker';

beforeEach(() => {
  mockGet.mockReset();
});

// The picker debounces searches by 300ms; wait for the data fetch to fire.
const flushDebounce = async () => {
  await waitFor(() => expect(mockGet).toHaveBeenCalled(), { timeout: 1500 });
};

// The dropdown opens on focus (not on change), so tests must focus first.
const openAndType = (value: string) => {
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  return input;
};

describe('EntityPicker', () => {
  it('renders the translated label', () => {
    render(
      <EntityPicker labelKey="ismsPhase6.fields.owner" entityType="user" />,
    );

    expect(screen.getByText('ismsPhase6.fields.owner')).toBeInTheDocument();
  });

  it('shows the selected value label in the input placeholder', () => {
    render(
      <EntityPicker
        labelKey="ismsPhase6.fields.owner"
        entityType="user"
        value={{ id: 'u-1', label: 'Alice Admin (alice@example.com)' }}
      />,
    );

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('placeholder', 'Alice Admin (alice@example.com)');
  });

  it('searches and selects a single entity, passing the human-readable option through', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 'u-1', name: 'Alice Admin', email: 'alice@example.com', isActive: true }],
    });
    const onChange = vi.fn();

    render(
      <EntityPicker labelKey="ismsPhase6.fields.owner" entityType="user" onChange={onChange} />,
    );

    openAndType('Ali');
    await flushDebounce();

    expect(mockGet).toHaveBeenCalledWith('/users/owners', {
      params: { q: 'Ali', page: 1, limit: 20 },
    });
    const option = await screen.findByRole('option', { name: 'Alice Admin (alice@example.com)' });
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith({
      id: 'u-1',
      label: 'Alice Admin (alice@example.com)',
    });
  });

  it('filters inactive users out of the options list', async () => {
    mockGet.mockResolvedValue({
      data: [
        { id: 'u-1', name: 'Alice Admin', email: 'alice@example.com', isActive: true },
        { id: 'u-2', name: 'Bob Inactive', email: 'bob@example.com', isActive: false },
      ],
    });

    render(<EntityPicker labelKey="ismsPhase6.fields.owner" entityType="user" />);

    openAndType('user');
    await flushDebounce();

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Alice Admin (alice@example.com)');
    expect(screen.queryByText(/Bob Inactive/)).not.toBeInTheDocument();
  });

  it('adds and removes values in multi-select mode', async () => {
    mockGet.mockResolvedValue({
      data: [
        { id: 'a-1', displayId: 'AST-001', name: 'Core Router' },
        { id: 'a-2', displayId: 'AST-002', name: 'Edge Firewall' },
      ],
    });
    const onValuesChange = vi.fn();

    render(
      <EntityPicker
        labelKey="ismsPhase6.fields.resources"
        entityType="asset"
        multiple
        values={[{ id: 'a-1', label: 'AST-001 - Core Router' }]}
        onValuesChange={onValuesChange}
      />,
    );

    // Selected values render as removable chips; the already selected option is
    // excluded from the available options list.
    expect(screen.getByText('AST-001 - Core Router')).toBeInTheDocument();

    openAndType('fire');
    await flushDebounce();

    expect(mockGet).toHaveBeenCalledWith('/assets', {
      params: { search: 'fire', page: 1, limit: 20 },
    });
    const option = await screen.findByRole('option', { name: 'AST-002 - Edge Firewall' });
    fireEvent.click(option);

    expect(onValuesChange).toHaveBeenCalledWith([
      { id: 'a-1', label: 'AST-001 - Core Router' },
      { id: 'a-2', label: 'AST-002 - Edge Firewall' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: /AST-001 - Core Router/ }));
    expect(onValuesChange).toHaveBeenCalledWith([]);
  });

  it('renders a clear button for clearable single-select values and calls onClear', () => {
    const onClear = vi.fn();

    render(
      <EntityPicker
        labelKey="ismsPhase6.fields.owner"
        entityType="user"
        value={{ id: 'u-1', label: 'Alice Admin (alice@example.com)' }}
        clearable
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'entityPicker.clear' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not render a clear button when not clearable or when the value is empty', () => {
    const { rerender } = render(
      <EntityPicker
        labelKey="ismsPhase6.fields.owner"
        entityType="user"
        value={{ id: 'u-1', label: 'Alice Admin (alice@example.com)' }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'entityPicker.clear' })).not.toBeInTheDocument();

    rerender(
      <EntityPicker labelKey="ismsPhase6.fields.owner" entityType="user" clearable value={null} />,
    );

    expect(screen.queryByRole('button', { name: 'entityPicker.clear' })).not.toBeInTheDocument();
  });
});
