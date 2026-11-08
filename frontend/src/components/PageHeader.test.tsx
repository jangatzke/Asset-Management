/**
 * Tests for the reusable page header (Stage 3, QW-4).
 *
 * Covers title/description/actions rendering and the breadcrumb accessibility
 * contract (`aria-current="page"` on the last entry, `Link` for routed items).
 */
import '@testing-library/jest-dom';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageHeader } from './PageHeader';

afterEach(() => cleanup());

describe('PageHeader', () => {
  it('renders title, description and actions', () => {
    render(
      <PageHeader
        title="Assets"
        description="All managed assets"
        actions={<button type="button">Create</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Assets');
    expect(screen.getByText('All managed assets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('omits the description paragraph when no description is given', () => {
    render(<PageHeader title="Tickets" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tickets');
    expect(screen.queryByText('All managed assets')).toBeNull();
  });

  it('renders breadcrumbs with aria-current on the last entry and Link for routed items', () => {
    render(
      <MemoryRouter>
        <PageHeader
          title="Detail"
          breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'List', to: '/list' }, { label: 'Detail' }]}
        />
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav).toBeInTheDocument();

    const current = within(nav).getByText('Detail');
    expect(current).toHaveAttribute('aria-current', 'page');

    const listLink = within(nav).getByRole('link', { name: 'List' });
    expect(listLink).toHaveAttribute('href', '/list');
  });

  it('renders a clickable breadcrumb button when onClick is provided', async () => {
    const onClick = vi.fn();
    render(
      <PageHeader
        title="Detail"
        breadcrumbs={[{ label: 'Back to list', onClick }, { label: 'Detail' }]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Back to list' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders the tabs slot below the header', () => {
    render(<PageHeader title="Page" tabs={<div>tab-panel-content</div>} />);
    expect(screen.getByText('tab-panel-content')).toBeInTheDocument();
  });
});
