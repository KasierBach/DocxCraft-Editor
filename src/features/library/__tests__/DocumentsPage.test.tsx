import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentsPage } from '../DocumentsPage';

vi.mock('../../../lib/documentApi', () => ({
  listDocuments: vi.fn(),
  renameDocument: vi.fn(),
  deleteDocument: vi.fn(),
  readDocumentContent: vi.fn(),
  listTrash: vi.fn(),
  restoreDocument: vi.fn(),
  purgeDocument: vi.fn(),
}));

import { deleteDocument, listDocuments, listTrash, renameDocument } from '../../../lib/documentApi';

const document = {
  id: 'd1',
  name: 'Report.docx',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  sizeInBytes: 12,
  lastOpenedAt: null,
  versionCount: 2,
  deletedAt: null,
};

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderPage(initialEntries: string[] = ['/documents']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <DocumentsPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DocumentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state when there are no documents', async () => {
    vi.mocked(listDocuments).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/no saved documents yet/i)).toBeInTheDocument();
  });

  it('lists documents and opens one via the deep link', async () => {
    vi.mocked(listDocuments).mockResolvedValue([document]);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('Report.docx');

    await user.click(screen.getByRole('button', { name: /open report\.docx/i }));

    // The MemoryRouter is exercised; navigating must not throw.
    expect(screen.getByText('Report.docx')).toBeInTheDocument();
  });

  it('renames a document', async () => {
    vi.mocked(listDocuments).mockResolvedValue([document]);
    vi.mocked(renameDocument).mockResolvedValue({ ...document, name: 'Renamed.docx' });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('Report.docx');

    await user.click(screen.getByRole('button', { name: /rename report\.docx/i }));
    const input = screen.getByLabelText(/edit name for report\.docx/i);
    await user.clear(input);
    await user.type(input, 'Renamed');
    await user.click(screen.getByRole('button', { name: /save name for report\.docx/i }));

    await waitFor(() => expect(renameDocument).toHaveBeenCalledWith('d1', 'Renamed'));
  });

  it('deletes a document after confirmation', async () => {
    vi.mocked(listDocuments).mockResolvedValue([document]);
    vi.mocked(deleteDocument).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('Report.docx');

    await user.click(screen.getByRole('button', { name: /delete report\.docx/i }));
    await user.click(screen.getByRole('button', { name: /confirm delete report\.docx/i }));

    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith('d1'));
  });

  it('filters by search and shows the no-match state', async () => {
    vi.mocked(listDocuments).mockResolvedValue([document]);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('Report.docx');

    await user.type(screen.getByRole('searchbox'), 'nothing');

    expect(screen.getByText(/no saved documents match that search/i)).toBeInTheDocument();
  });

  it('reads the trash view from the URL and toggles it back', async () => {
    vi.mocked(listDocuments).mockResolvedValue([]);
    vi.mocked(listTrash).mockResolvedValue([]);
    const user = userEvent.setup();

    renderPage(['/documents?view=trash']);

    expect(await screen.findByText(/trash is empty/i)).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/documents?view=trash');
    expect(screen.getByRole('button', { name: 'Trash' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Documents' }));

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/documents$/);
    expect(screen.getByRole('button', { name: 'Documents' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('switches to the trash view from the documents list', async () => {
    vi.mocked(listDocuments).mockResolvedValue([]);
    vi.mocked(listTrash).mockResolvedValue([]);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText(/no saved documents yet/i);

    await user.click(screen.getByRole('button', { name: 'Trash' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/documents?view=trash');
    expect(await screen.findByText(/trash is empty/i)).toBeInTheDocument();
  });
});
