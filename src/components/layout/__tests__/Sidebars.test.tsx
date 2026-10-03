import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Sidebar } from '../Sidebar';
import { RightSidebar } from '../RightSidebar';

const anchors = [
  { id: 'paragraph-1', label: 'Overview', pageNumber: 1, paragraphIndex: 0, styleId: 'Heading1' },
  { id: 'paragraph-2', label: 'Details', pageNumber: 2, paragraphIndex: 1, styleId: 'Normal' },
];

describe('Sidebar interactions', () => {
  it('filters, clears, selects the intended paragraph and closes the drawer', async () => {
    const onJump = vi.fn();
    const onClose = vi.fn();
    function Outline() {
      const [query, setQuery] = useState('');
      const [style, setStyle] = useState('outline');
      const filtered = anchors.filter((anchor) =>
        anchor.label.toLowerCase().includes(query.toLowerCase()) &&
        (style === 'outline' || style === 'all' || anchor.styleId === style));
      return <Sidebar anchors={anchors} filteredAnchors={filtered} activeParaId={null}
        onJump={onJump} searchQuery={query} onSearchChange={setQuery} filterStyle={style}
        onStyleChange={setStyle} uniqueStyles={['Heading1', 'Normal']}
        onResetFilters={() => { setQuery(''); setStyle('outline'); }} onClose={onClose} />;
    }
    const user = userEvent.setup();
    render(<Outline />);
    await user.type(screen.getByRole('searchbox'), 'Details');
    expect(screen.queryByRole('button', { name: /overview/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /details/i }));
    expect(onJump).toHaveBeenCalledWith('paragraph-2');
    await user.click(screen.getByRole('button', { name: /clear outline filters/i }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox'), 'Heading1');
    expect(screen.queryByRole('button', { name: /details/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close document outline/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('omits drawer controls when used as a permanent desktop sidebar', () => {
    render(<Sidebar anchors={[]} filteredAnchors={[]} activeParaId={null} onJump={vi.fn()}
      searchQuery="" onSearchChange={vi.fn()} filterStyle="outline" onStyleChange={vi.fn()}
      uniqueStyles={[]} onResetFilters={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /close document outline/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no matching paragraphs/i)).toBeInTheDocument();
  });
});

const rightDefaults: ComponentProps<typeof RightSidebar> = {
  activeParaId: null, documentName: 'Draft.docx', currentPage: null, currentTargetLabel: 'No paragraph selected',
  currentDocumentId: null, currentDocumentVersions: [], savedDocuments: [], isLoadingDocuments: false,
  isLoadingVersions: false, recoverySnapshot: null, mediaItems: [], onRestoreRecovery: () => undefined,
  onDiscardRecovery: () => undefined, onOpenDocument: () => undefined, onRenameDocument: () => undefined,
  onDeleteDocument: () => undefined, onDuplicateDocument: () => undefined, onDownloadDocument: () => undefined,
  onRefreshDocuments: () => undefined, onRestoreVersion: () => undefined, onDownloadVersion: () => undefined,
  onJumpToMedia: () => undefined,
};

function renderDetails(props: ComponentProps<typeof RightSidebar>) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <RightSidebar {...props} />
  </QueryClientProvider>);
}

describe('RightSidebar interactions', () => {
  it('shows missing selection/page without inventing a target', () => {
    renderDetails(rightDefaults);
    expect(screen.getByText('Draft.docx')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it('locks recovery controls until restore finishes, then allows dismissal', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const onRestoreRecovery = vi.fn(() => pending);
    const onDiscardRecovery = vi.fn();
    const user = userEvent.setup();
    renderDetails({ ...rightDefaults, activeParaId: 'paragraph-2', currentPage: 2,
      recoverySnapshot: { sourceKind: 'saved-document', documentId: 'saved-1', documentName: 'Draft.docx',
        activeParaId: 'paragraph-2', savedAt: '2026-10-03T00:00:00Z', buffer: new ArrayBuffer(4) },
      onRestoreRecovery, onDiscardRecovery });
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(screen.getByRole('button', { name: /restoring/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /restoring/i }));
    expect(onRestoreRecovery).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await pending; });
    expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDiscardRecovery).toHaveBeenCalledTimes(1);
  });

  it('passes the actual media location and closes the details drawer', async () => {
    const media = { id: 'image-2', type: 'image' as const, label: 'Chart on page two', paraId: null, position: 24, paragraphIndex: 3 };
    const onJumpToMedia = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDetails({ ...rightDefaults, mediaItems: [media], onJumpToMedia, onClose });
    await user.click(screen.getByRole('button', { name: /chart on page two/i }));
    expect(onJumpToMedia).toHaveBeenCalledWith(media);
    await user.click(screen.getByRole('button', { name: /close document details/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
