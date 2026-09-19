import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderProfile } from '../../../test/profileHarness';
import { WorkspaceSection } from '../sections/WorkspaceSection';

vi.mock('../../../lib/documentApi', () => ({ listDocuments: vi.fn() }));

import { listDocuments } from '../../../lib/documentApi';

function makeDocument(
  id: string,
  updatedAt: string,
  lastOpenedAt: string | null,
): {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sizeInBytes: number;
  lastOpenedAt: string | null;
  versionCount: number;
  deletedAt: string | null;
} {
  return {
    id,
    name: `${id}.docx`,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt,
    sizeInBytes: 2048,
    lastOpenedAt,
    versionCount: 2,
    deletedAt: null,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

describe('WorkspaceSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state when there are no documents', async () => {
    vi.mocked(listDocuments).mockResolvedValue([]);

    renderProfile(<WorkspaceSection />);

    expect((await screen.findAllByText(/nothing to continue yet/i)).length).toBeGreaterThan(0);
  });

  it('offers a retry when documents fail to load', async () => {
    vi.mocked(listDocuments).mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();

    renderProfile(<WorkspaceSection />);

    expect(await screen.findByText(/could not load your documents/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(listDocuments).toHaveBeenCalledTimes(2));
  });

  it('lists the three most recently opened documents and opens one', async () => {
    vi.mocked(listDocuments).mockResolvedValue([
      makeDocument('d1', '2026-09-10T00:00:00.000Z', '2026-09-10T00:00:00.000Z'),
      makeDocument('d2', '2026-09-12T00:00:00.000Z', '2026-09-13T00:00:00.000Z'),
      makeDocument('d3', '2026-09-11T00:00:00.000Z', '2026-09-12T00:00:00.000Z'),
      makeDocument('d4', '2026-09-09T00:00:00.000Z', null),
    ]);
    const user = userEvent.setup();

    renderProfile(
      <>
        <WorkspaceSection />
        <LocationProbe />
      </>,
    );

    await screen.findAllByText('d2.docx');
    const openButtons = screen.getAllByRole('button', { name: /^open$/i });
    expect(openButtons).toHaveLength(3);

    await user.click(openButtons[0]);

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/app?source=saved&documentId=d2',
    );
  });

  it('caps the updated table at five rows, newest first', async () => {
    const documents = Array.from({ length: 7 }, (_, index) =>
      makeDocument(
        `d${index + 1}`,
        `2026-09-0${index + 1}T00:00:00.000Z`,
        null,
      ),
    );
    vi.mocked(listDocuments).mockResolvedValue(documents);

    renderProfile(<WorkspaceSection />);

    await screen.findByRole('table');
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(6);
    expect(rows[1]).toHaveTextContent('d7.docx');
  });
});
