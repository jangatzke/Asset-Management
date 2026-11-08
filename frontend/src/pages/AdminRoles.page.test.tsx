/**
 * Page-level tests for AdminRoles.
 *
 * The real Modal/ConfirmDialog/DataTableShell and useDirtyForm/useLocalSort
 * hooks are exercised; only `adminApi` and i18n are mocked. The tests assert
 * user-visible state plus the exact create/update/delete payloads, including
 * the Administration permission sync rule between the checkbox and the
 * permission list.
 */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, flush } from '../test/renderWithProviders';
import AdminRoles from './AdminRoles';

vi.mock('../context/I18nContext', () => {
  const t = (key: string) => key;
  return { useI18n: () => ({ t, language: 'en', setLanguage: vi.fn() }) };
});

const adminApiMock = vi.hoisted(() => ({
  getRoles: vi.fn(),
  getRole: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
}));

vi.mock('../services/api', () => ({ adminApi: adminApiMock }));

const builtInRole = {
  id: 'r-1',
  name: 'Administrator',
  description: 'Full access to everything',
  isBuiltIn: true,
  canAccessAdmin: true,
  permissionNames: ['administration.access', 'tickets.read', 'tickets.write', 'risks.read'],
};

const customRole = {
  id: 'r-2',
  name: 'Auditor',
  description: null,
  isBuiltIn: false,
  canAccessAdmin: false,
  permissionNames: ['audits.read'],
};

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

function roleRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll('tbody tr')) as HTMLElement[];
}

beforeEach(() => {
  adminApiMock.getRoles.mockResolvedValue({ data: [customRole, builtInRole] });
  adminApiMock.getRole.mockResolvedValue({ data: customRole });
  adminApiMock.createRole.mockResolvedValue({ data: { ...customRole, id: 'r-9' } });
  adminApiMock.updateRole.mockResolvedValue({ data: customRole });
  adminApiMock.deleteRole.mockResolvedValue({ data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AdminRoles page', () => {
  it('loads roles, sorts them by name and renders badges, permissions and actions', async () => {
    renderWithProviders(<AdminRoles />);
    await flush();

    expect(adminApiMock.getRoles).toHaveBeenCalledTimes(1);

    const rows = roleRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Administrator');
    expect(rows[0]).toHaveTextContent('Full access to everything');
    expect(rows[0]).toHaveTextContent('roles.builtIn');
    expect(rows[0]).toHaveTextContent('roles.adminAccess');
    expect(rows[0]).toHaveTextContent('4');
    expect(rows[1]).toHaveTextContent('Auditor');
    expect(rows[1]).toHaveTextContent('—');
    expect(rows[1]).toHaveTextContent('1');

    const editButtons = screen.getAllByRole('button', { name: 'common.edit' });
    expect(editButtons[0]).toBeDisabled();
    expect(editButtons[1]).not.toBeDisabled();

    expect(screen.getAllByRole('button', { name: 'common.delete' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('renders the loading state before roles resolve', async () => {
    adminApiMock.getRoles.mockImplementation(() => new Promise(() => undefined));

    renderWithProviders(<AdminRoles />);

    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('surfaces the server error message when loading roles fails', async () => {
    adminApiMock.getRoles.mockRejectedValue({
      response: { data: { error: { message: 'Role catalog unavailable' } } },
    });

    renderWithProviders(<AdminRoles />);
    await flush();

    expect(screen.getByText('Role catalog unavailable')).toBeInTheDocument();
  });

  it('opens the create modal and blocks submission on an empty name', async () => {
    renderWithProviders(<AdminRoles />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'roles.newRole' }));

    expect(dialog()).toHaveTextContent('roles.createRole');
    expect(within(dialog()).getByPlaceholderText('roles.roleName')).toBeInTheDocument();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.save' }));
    await flush();

    expect(screen.getByText('roles.nameRequired')).toBeInTheDocument();
    expect(adminApiMock.createRole).not.toHaveBeenCalled();
  });

  it('creates a role with the selected permissions and syncs admin access', async () => {
    renderWithProviders(<AdminRoles />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'roles.newRole' }));
    fireEvent.change(within(dialog()).getByPlaceholderText('roles.roleName'), { target: { value: '  Risk Auditor  ' } });
    fireEvent.change(within(dialog()).getByPlaceholderText('roles.roleDescription'), { target: { value: 'Reviews risk registers' } });

    const adminAccess = within(dialog()).getByRole('checkbox', { name: 'roles.adminAccess(roles.adminAccessHint)' });
    fireEvent.click(adminAccess);

    expect(adminAccess).toBeChecked();
    expect(within(dialog()).queryByRole('checkbox', { name: 'administration.access' })).toBeNull();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(adminApiMock.createRole).toHaveBeenCalledTimes(1);
    });
    const payload = adminApiMock.createRole.mock.calls[0][0];
    expect(payload.name).toBe('Risk Auditor');
    expect(payload.description).toBe('Reviews risk registers');
    expect(payload.canAccessAdmin).toBe(true);
    expect(payload.permissionNames).toContain('administration.access');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('roles.roleCreated')).toBeInTheDocument();
    expect(adminApiMock.getRoles).toHaveBeenCalledTimes(2);
  });

  it('edits a role, prefilling from getRole and sending the update payload', async () => {
    renderWithProviders(<AdminRoles />);
    await flush();

    fireEvent.click(screen.getAllByRole('button', { name: 'common.edit' })[1]);
    await waitFor(() => {
      expect(adminApiMock.getRole).toHaveBeenCalledWith('r-2');
    });

    const nameInput = await within(dialog()).findByDisplayValue('Auditor');
    expect(within(dialog()).getByRole('checkbox', { name: 'audits.read' })).toBeChecked();
    expect(dialog()).toHaveTextContent('roles.editRole');

    fireEvent.change(nameInput, { target: { value: 'Senior Auditor' } });
    fireEvent.change(within(dialog()).getByPlaceholderText('roles.roleDescription'), { target: { value: 'Audits the ISMS' } });

    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(adminApiMock.updateRole).toHaveBeenCalledTimes(1);
    });
    const payload = adminApiMock.updateRole.mock.calls[0][1];
    expect(payload.name).toBe('Senior Auditor');
    expect(payload.description).toBe('Audits the ISMS');
    expect(payload.permissionNames).toEqual(['audits.read']);
    expect(payload.canAccessAdmin).toBe(false);
    expect(screen.getByText('roles.roleUpdated')).toBeInTheDocument();
  });

  it('toggles individual permission checkboxes in the editor', async () => {
    renderWithProviders(<AdminRoles />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'roles.newRole' }));

    const riskRead = within(dialog()).getByText('risks.read');
    fireEvent.click(riskRead);
    fireEvent.click(within(dialog()).getByText('risks.write'));
    fireEvent.click(within(dialog()).getByText('risks.read'));

    await flush();

    expect(dialog()).toHaveTextContent('1');

    fireEvent.change(within(dialog()).getByPlaceholderText('roles.roleName'), { target: { value: 'Risk Writer' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(adminApiMock.createRole).toHaveBeenCalledTimes(1);
    });
    expect(adminApiMock.createRole.mock.calls[0][0].permissionNames).toEqual(['risks.write']);
  });

  it('asks for confirmation before deleting a custom role', async () => {
    renderWithProviders(<AdminRoles />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));

    expect(dialog()).toHaveTextContent('common.confirmDelete');
    expect(dialog()).toHaveTextContent('common.confirmDeleteNamed');
    expect(adminApiMock.deleteRole).not.toHaveBeenCalled();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.confirm' }));

    await waitFor(() => {
      expect(adminApiMock.deleteRole).toHaveBeenCalledWith('r-2');
    });
    expect(screen.getByText('roles.roleDeleted')).toBeInTheDocument();
    expect(adminApiMock.getRoles).toHaveBeenCalledTimes(2);
  });

  it('closes the delete dialog without deleting when cancelled', async () => {
    renderWithProviders(<AdminRoles />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(adminApiMock.deleteRole).not.toHaveBeenCalled();
  });

  it('reports a save error message from the server', async () => {
    adminApiMock.createRole.mockRejectedValue({
      response: { data: { error: { message: 'Role name already exists' } } },
    });

    renderWithProviders(<AdminRoles />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'roles.newRole' }));
    fireEvent.change(within(dialog()).getByPlaceholderText('roles.roleName'), { target: { value: 'Auditor' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(screen.getByText('Role name already exists')).toBeInTheDocument();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('toggles the sort direction through the sortable column header', async () => {
    renderWithProviders(<AdminRoles />);
    await flush();

    const nameHeader = screen.getByRole('button', { name: 'common.name' });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(nameHeader);
    await flush();

    expect(screen.getByRole('button', { name: 'common.name' })).toHaveAttribute('aria-sort', 'descending');
    const rows = roleRows();
    expect(rows[0]).toHaveTextContent('Auditor');
  });
});
