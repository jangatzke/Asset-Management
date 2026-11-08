/**
 * Page-level tests for AssetDetail.
 *
 * AssetGraph is replaced with a lightweight stub (it needs canvas + graph
 * endpoints of its own); the stub exposes the props the page hands over so we
 * can assert the fallback node contract.
 */
import '@testing-library/jest-dom';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, flush, resetAuthUser } from '../test/renderWithProviders';
import AssetDetail from './AssetDetail';

vi.mock('../context/I18nContext', () => {
  const t = (key: string) => key;
  return { useI18n: () => ({ t, language: 'en', setLanguage: vi.fn() }) };
});

const { route } = vi.hoisted(() => ({
  route: { assetId: 'asset-1' },
}));

vi.mock('react-router-dom', async (importOriginal: () => Promise<typeof import('react-router-dom')>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useParams: () => ({ assetId: route.assetId }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

const graphProps = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('../components/AssetGraph', () => ({
  default: (props: Record<string, unknown>) => {
    graphProps.push(props);
    return <div data-testid="asset-graph-stub">{String(props.assetId)}</div>;
  },
}));

const assetApiMock = vi.hoisted(() => ({
  getById: vi.fn(),
}));

vi.mock('../services/api', () => ({ assetApi: assetApiMock }));

const fileServer = {
  id: 'asset-1',
  displayId: 'AST-0001',
  name: 'File server',
  description: 'Primary SMB file server',
  criticality: 'high',
  lifecycleStatus: 'operational',
  status: 'in_use',
  inventoryNumber: 'INV-42',
  manufacturer: 'Dell',
  model: 'PowerEdge R750',
  serialNumber: 'SN-1234',
  assetType: { name: 'Server' },
  assetSubtype: { name: 'Virtual' },
  organizationUnit: { name: 'IT Infrastructure' },
};

beforeEach(() => {
  graphProps.length = 0;
  assetApiMock.getById.mockResolvedValue({ data: fileServer });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  resetAuthUser();
});

describe('AssetDetail page', () => {
  it('loads the asset by route id and renders header plus detail fields', async () => {
    renderWithProviders(<AssetDetail />);
    await flush();

    expect(assetApiMock.getById).toHaveBeenCalledWith('asset-1');
    expect(screen.getByRole('heading', { name: /AST-0001.*File server/ })).toBeInTheDocument();
    expect(screen.getByText(/Server.*Virtual.*high criticality.*operational/)).toBeInTheDocument();
    expect(screen.getByText('Primary SMB file server')).toBeInTheDocument();

    const checks: Array<[string, string]> = [
      ['assets.fields.inventoryNumber', 'INV-42'],
      ['assets.fields.manufacturer', 'Dell'],
      ['assets.fields.model', 'PowerEdge R750'],
      ['assets.fields.serialNumber', 'SN-1234'],
      ['common.status', 'in_use'],
      ['assets.organizationUnit', 'IT Infrastructure'],
    ];
    for (const [label, value] of checks) {
      const term = screen.getByText(label);
      expect((term.parentElement as HTMLElement).querySelector('dd')).toHaveTextContent(value);
    }
    expect(screen.getByRole('link', { name: /navigation\.assets/ })).toHaveAttribute('href', '/assets');
  });

  it('renders an em dash for optional fields the API omitted', async () => {
    assetApiMock.getById.mockResolvedValue({
      data: {
        id: 'asset-2',
        displayId: 'AST-0002',
        name: 'Spare switch',
        criticality: 'low',
        lifecycleStatus: 'planned',
      },
    });

    renderWithProviders(<AssetDetail />);
    await flush();

    const emptyTerms = [
      'assets.fields.inventoryNumber',
      'assets.fields.manufacturer',
      'assets.fields.model',
      'assets.fields.serialNumber',
      'common.status',
      'assets.organizationUnit',
    ];
    for (const label of emptyTerms) {
      const term = screen.getByText(label);
      expect((term.parentElement as HTMLElement).querySelector('dd')).toHaveTextContent('—');
    }
    // No description paragraph when the API returns none.
    expect(screen.queryByText('Primary SMB file server')).toBeNull();
  });

  it('shows the loading placeholder while the asset request is in flight', async () => {
    assetApiMock.getById.mockImplementation(() => new Promise(() => undefined));

    renderWithProviders(<AssetDetail />);

    expect(screen.getByText('assets.detail.loading')).toBeInTheDocument();
  });

  it('shows the not-found error with a back link when the request fails', async () => {
    assetApiMock.getById.mockRejectedValue({
      response: { data: { error: { message: 'Asset missing' } } },
    });

    renderWithProviders(<AssetDetail />);
    await flush();

    expect(screen.getByRole('alert')).toHaveTextContent('Asset missing');
    expect(screen.getByRole('link', { name: /navigation\.assets/ })).toHaveAttribute('href', '/assets');
    expect(screen.queryByTestId('asset-graph-stub')).toBeNull();
  });

  it('falls back to the generic not-found message when the error has no server text', async () => {
    assetApiMock.getById.mockRejectedValue({});

    renderWithProviders(<AssetDetail />);
    await flush();

    expect(screen.getByRole('alert')).toHaveTextContent('assets.detail.notFound');
  });

  it('passes the asset identity and fallback node to the relationship graph', async () => {
    renderWithProviders(<AssetDetail />);
    await waitFor(() => {
      expect(screen.getByTestId('asset-graph-stub')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'assets.detail.relationshipsHeading' })).toBeInTheDocument();
    const props = graphProps[graphProps.length - 1];
    expect(props.assetId).toBe('asset-1');
    expect(props.focusAssetId).toBe('asset-1');
    expect(props.fallbackNode).toEqual({
      id: 'asset-1',
      name: 'File server',
      displayId: 'AST-0001',
      type: 'Server',
      criticality: 'high',
    });
  });
});
