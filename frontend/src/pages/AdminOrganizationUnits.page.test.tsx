/**
 * Page-level tests for the organization-unit administration page.
 *
 * The real Modal/ConfirmDialog/useDirtyForm components are exercised. The
 * entity search widget is replaced by a deterministic stub that can select a
 * parent unit, and `adminApi`/`entityPickerApi` are mocked. The tests cover the
 * list + client-side filtering, the include-archived reload, trimmed create
 * payloads, edit prefill, archive confirmation and restore flows.
 */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, flush } from '../test/renderWithProviders';
import AdminOrganizationUnits from './AdminOrganizationUnits';

vi.mock('../context/I18nContext', () => {
  const t = (key: string) => key;
  return { useI18n: () => ({ t, language: 'en', setLanguage: vi.fn() }) };
});

const adminApiMock = vi.hoisted(() => ({
  listOrganizationUnits: vi.fn(),
  createOrganizationUnit: vi.fn(),
  updateOrganizationUnit: vi.fn(),
  archiveOrganizationUnit: vi.fn(),
  restoreOrganizationUnit: vi.fn(),
}));

vi.mock('../services/api', () => ({ adminApi: adminApiMock }));

vi.mock('../services/entityPickerApi', () => ({
  entitySearchEndpoint: () => async () => [],
}));

vi.mock('../components/EntitySearchSelect', () => ({
  default: ({ placeholder, onChange, value }: any) => (
    <div>
      <input aria-label="parent-search" placeholder={placeholder} />
      {value
        ? <span>selected:{value.label}</span>
        : <button type="button" onClick={() => onChange?.({ id: 'ou-9', label: 'Operations' })}>select-parent</button>}
    </div>
  ),
}));

const activeUnit = {
  id: 'ou-1',
  name: 'Engineering',
  description: 'Builds the platform',
  parent: { id: 'ou-7', name: 'Operations' },
  parentId: 'ou-7',
  type: 'Division',
  isArchived: false,
  _count: { children: 2, users: 5, assets: 12, risks: 3, controlImplementations: 4 },
};

const archivedUnit = {
  id: 'ou-2',
  name: 'Sales Ops',
  description: null,
  parent: null,
  parentId: null,
  type: null,
  isArchived: true,
  _count: {},
};

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

function unitCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll('div.p-4.rounded-md, div.p-4')).filter((element) =>
    element.querySelector('h2') !== null,
  ) as HTMLElement[];
}

function modalFieldByLabel(label: string): HTMLElement {
  const labelElement = within(dialog()).getByText(label);
  return (labelElement.parentElement?.querySelector('input, textarea') ?? labelElement) as HTMLElement;
}

beforeEach(() => {
  adminApiMock.listOrganizationUnits.mockResolvedValue({ data: { data: [activeUnit, archivedUnit] } });
  adminApiMock.createOrganizationUnit.mockResolvedValue({ data: { id: 'ou-3' } });
  adminApiMock.updateOrganizationUnit.mockResolvedValue({ data: { id: 'ou-1' } });
  adminApiMock.archiveOrganizationUnit.mockResolvedValue({ data: {} });
  adminApiMock.restoreOrganizationUnit.mockResolvedValue({ data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AdminOrganizationUnits page', () => {
  it('loads units and renders hierarchy, counts and archived actions', async () => {
    renderWithProviders(<AdminOrganizationUnits />);
    await flush();

    expect(adminApiMock.listOrganizationUnits).toHaveBeenCalledWith(false);

    const cards = unitCards();
    expect(cards).toHaveLength(2);

    expect(cards[0]).toHaveTextContent('Engineering');
    expect(cards[0]).toHaveTextContent('Division · organizationUnits.parent: Operations');
    expect(cards[0]).toHaveTextContent('Builds the platform');
    expect(cards[0]).toHaveTextContent('organizationUnits.children: 2');
    expect(cards[0]).toHaveTextContent('organizationUnits.users: 5');
    expect(cards[0]).toHaveTextContent('organizationUnits.assets: 12');
    expect(cards[0]).toHaveTextContent('organizationUnits.risks: 3');
    expect(cards[0]).toHaveTextContent('organizationUnits.implementations: 4');

    expect(cards[1]).toHaveTextContent('Sales Ops');
    expect(cards[1]).toHaveTextContent('organizationUnits.archived');
    expect(cards[1]).toHaveTextContent('organizationUnits.children: 0');

    expect(screen.getAllByRole('button', { name: 'common.edit' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'organizationUnits.archive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'organizationUnits.restore' })).toBeInTheDocument();
  });

  it('renders the loading placeholder before units resolve', () => {
    adminApiMock.listOrganizationUnits.mockImplementation(() => new Promise(() => undefined));

    renderWithProviders(<AdminOrganizationUnits />);

    expect(screen.getByText('organizationUnits.loading')).toBeInTheDocument();
  });

  it('surfaces the server error message when loading fails', async () => {
    adminApiMock.listOrganizationUnits.mockRejectedValue({
      response: { data: { error: { message: 'Org unit catalog unavailable' } } },
    });

    renderWithProviders(<AdminOrganizationUnits />);
    await flush();

    expect(screen.getByText('Org unit catalog unavailable')).toBeInTheDocument();
  });

  it('filters units client-side by name, description and type', async () => {
    renderWithProviders(<AdminOrganizationUnits />);
    await flush();

    const search = screen.getByPlaceholderText('organizationUnits.searchPlaceholder');

    fireEvent.change(search, { target: { value: 'sales' } });
    expect(screen.queryByText('Engineering')).toBeNull();
    expect(screen.getByText('Sales Ops')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'builds' } });
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.queryByText('Sales Ops')).toBeNull();

    fireEvent.change(search, { target: { value: 'division' } });
    expect(screen.getByText('Engineering')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'no-such-unit' } });
    expect(screen.getByText('organizationUnits.noUnits')).toBeInTheDocument();
    expect(adminApiMock.listOrganizationUnits).toHaveBeenCalledTimes(1);
  });

  it('reloads with archived units when the filter is enabled', async () => {
    renderWithProviders(<AdminOrganizationUnits />);
    await flush();

    fireEvent.click(screen.getByLabelText('organizationUnits.includeArchived'));

    await waitFor(() => {
      expect(adminApiMock.listOrganizationUnits).toHaveBeenCalledWith(true);
    });
    expect(adminApiMock.listOrganizationUnits).toHaveBeenCalledTimes(2);
  });

  it('creates a unit with trimmed fields and the selected parent', async () => {
    renderWithProviders(<AdminOrganizationUnits />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'organizationUnits.newUnit' }));
    expect(dialog()).toHaveTextContent('organizationUnits.newUnit');

    fireEvent.change(modalFieldByLabel('common.name'), { target: { value: '  Platform Team  ' } });
    fireEvent.change(within(dialog()).getByPlaceholderText('organizationUnits.typePlaceholder'), { target: { value: '  Division  ' } });
    fireEvent.change(modalFieldByLabel('organizationUnits.description'), { target: { value: '  Runs the platform  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'select-parent' }));

    expect(within(dialog()).getByText('selected:Operations')).toBeInTheDocument();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.create' }));

    await waitFor(() => {
      expect(adminApiMock.createOrganizationUnit).toHaveBeenCalledTimes(1);
    });
    expect(adminApiMock.createOrganizationUnit).toHaveBeenCalledWith({
      name: 'Platform Team',
      description: 'Runs the platform',
      parentId: 'ou-9',
      type: 'Division',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('organizationUnits.createSuccess')).toBeInTheDocument();
    expect(adminApiMock.listOrganizationUnits).toHaveBeenCalledTimes(2);
  });

  it('omits blank optional fields and blocks a nameless unit', async () => {
    renderWithProviders(<AdminOrganizationUnits />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'organizationUnits.newUnit' }));

    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.create' }));
    expect(screen.getByText('organizationUnits.nameRequired')).toBeInTheDocument();
    expect(adminApiMock.createOrganizationUnit).not.toHaveBeenCalled();

    fireEvent.change(modalFieldByLabel('common.name'), { target: { value: 'Finance' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.create' }));

    await waitFor(() => {
      expect(adminApiMock.createOrganizationUnit).toHaveBeenCalledTimes(1);
    });
    expect(adminApiMock.createOrganizationUnit).toHaveBeenCalledWith({
      name: 'Finance',
      description: undefined,
      parentId: undefined,
      type: undefined,
    });
  });

  it('prefills the edit form, clears the parent and sends the update payload', async () => {
    renderWithProviders(<AdminOrganizationUnits />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));

    expect(dialog()).toHaveTextContent('organizationUnits.editUnit');
    expect(modalFieldByLabel('common.name')).toHaveValue('Engineering');
    expect(within(dialog()).getByText('selected:Operations')).toBeInTheDocument();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'organizationUnits.clearParent' }));
    expect(within(dialog()).queryByText('selected:Operations')).toBeNull();

    fireEvent.change(modalFieldByLabel('organizationUnits.description'), { target: { value: 'Builds the platform core' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.update' }));

    await waitFor(() => {
      expect(adminApiMock.updateOrganizationUnit).toHaveBeenCalledTimes(1);
    });
    expect(adminApiMock.updateOrganizationUnit).toHaveBeenCalledWith('ou-1', {
      name: 'Engineering',
      description: 'Builds the platform core',
      parentId: undefined,
      type: 'Division',
    });
    expect(screen.getByText('organizationUnits.updateSuccess')).toBeInTheDocument();
  });

  it('asks for confirmation before archiving a unit', async () => {
    renderWithProviders(<AdminOrganizationUnits />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'organizationUnits.archive' }));

    expect(dialog()).toHaveTextContent('organizationUnits.archiveConfirm');
    expect(dialog()).toHaveTextContent('common.archiveNamed');
    expect(adminApiMock.archiveOrganizationUnit).not.toHaveBeenCalled();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.confirm' }));

    await waitFor(() => {
      expect(adminApiMock.archiveOrganizationUnit).toHaveBeenCalledWith('ou-1');
    });
    expect(screen.getByText('organizationUnits.archiveSuccess')).toBeInTheDocument();
    expect(adminApiMock.listOrganizationUnits).toHaveBeenCalledTimes(2);
  });

  it('closes the archive dialog without archiving when cancelled', async () => {
    renderWithProviders(<AdminOrganizationUnits />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'organizationUnits.archive' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(adminApiMock.archiveOrganizationUnit).not.toHaveBeenCalled();
  });

  it('restores an archived unit and reloads the list', async () => {
    renderWithProviders(<AdminOrganizationUnits />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'organizationUnits.restore' }));

    await waitFor(() => {
      expect(adminApiMock.restoreOrganizationUnit).toHaveBeenCalledWith('ou-2');
    });
    expect(screen.getByText('organizationUnits.restoreSuccess')).toBeInTheDocument();
    expect(adminApiMock.listOrganizationUnits).toHaveBeenCalledTimes(2);
  });

  it('reports a save error and keeps the dialog open', async () => {
    adminApiMock.updateOrganizationUnit.mockRejectedValue({
      response: { data: { error: { message: 'Unit name already exists' } } },
    });

    renderWithProviders(<AdminOrganizationUnits />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));
    fireEvent.change(modalFieldByLabel('common.name'), { target: { value: 'Engineering Duplicate' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.update' }));

    await waitFor(() => {
      expect(screen.getByText('Unit name already exists')).toBeInTheDocument();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(adminApiMock.listOrganizationUnits).toHaveBeenCalledTimes(1);
  });
});
