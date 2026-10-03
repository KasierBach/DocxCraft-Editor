import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Header } from '../Header';

function renderHeader(options?: { canReload?: boolean; theme?: 'light' | 'dark' }) {
  const onExportMarkdown = vi.fn();
  const onPrintPDF = vi.fn();
  const onDownloadCurrent = vi.fn();
  const onSaveAs = vi.fn();
  const onLoadSample = vi.fn();
  const onReload = vi.fn();
  const onToggleTheme = vi.fn();
  const onShowDocs = vi.fn();
  const onShowChangelog = vi.fn();
  const onShowHome = vi.fn();
  const user = userEvent.setup();

  render(
    <div>
      <Header
        showSidebar
        onToggleSidebar={vi.fn()}
        showInfo
        onToggleInfo={vi.fn()}
        theme={options?.theme ?? 'light'}
        onToggleTheme={onToggleTheme}
        documentName="Quarterly Report.docx"
        onDocumentNameChange={vi.fn()}
        isDirty={false}
        apiStatus="connected"
        onLoadSample={onLoadSample}
        onReload={onReload}
        canReload={options?.canReload ?? true}
        onFileChange={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={onSaveAs}
        onDownloadCurrent={onDownloadCurrent}
        isSaving={false}
        onRefresh={vi.fn()}
        sourceKind="sample"
        onExportMarkdown={onExportMarkdown}
        onPrintPDF={onPrintPDF}
        editorMode="editing"
        onEditorModeChange={vi.fn()}
        onShowDocs={onShowDocs}
        onShowChangelog={onShowChangelog}
        onShowHome={onShowHome}
      />
      <button type="button">Outside</button>
      <div className="editor-host">
        <div className="ProseMirror" contentEditable tabIndex={0} aria-label="Document body" />
      </div>
    </div>,
  );

  return {
    onDownloadCurrent,
    onExportMarkdown,
    onLoadSample,
    onPrintPDF,
    onReload,
    onSaveAs,
    onShowChangelog,
    onShowDocs,
    onShowHome,
    onToggleTheme,
    user,
  };
}

describe('Header action menus', () => {
  it.each(['Export', 'More actions'])('keeps %s open if SDK focus arrives before the menu focus frame', async (menuName) => {
    renderHeader();
    const trigger = screen.getByRole('button', { name: menuName });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    act(() => screen.getByLabelText('Document body').focus());
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(screen.getAllByRole('menuitem')[0]).toHaveFocus());
  });

  it.each(['Export', 'More actions'])('keeps %s usable when SDK focus arrives after the menu opens', async (menuName) => {
    const { user } = renderHeader();
    const trigger = screen.getByRole('button', { name: menuName });
    await user.click(trigger);
    const firstItem = screen.getAllByRole('menuitem')[0];
    await waitFor(() => expect(firstItem).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    const chosenItem = screen.getAllByRole('menuitem')[1];
    expect(chosenItem).toHaveFocus();

    act(() => screen.getByLabelText('Document body').focus());

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(chosenItem).toHaveFocus());
    await user.click(chosenItem);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it.each(['Export', 'More actions'])('allows Tab to leave %s without restoring menu focus', async (menuName) => {
    const { user } = renderHeader();
    const trigger = screen.getByRole('button', { name: menuName });
    await user.click(trigger);
    const items = screen.getAllByRole('menuitem');
    await waitFor(() => expect(items[0]).toHaveFocus());
    act(() => {
      screen.getByRole('button', { name: 'Outside' }).tabIndex = -1;
      if (menuName === 'Export') {
        screen.getByRole('button', { name: 'More actions' }).tabIndex = -1;
      }
      items[items.length - 1].focus();
    });
    await user.tab();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Document body')).toHaveFocus();
  });

  it.each(['Export', 'More actions'])('allows an intentional editor click to close %s', async (menuName) => {
    const { user } = renderHeader();
    const trigger = screen.getByRole('button', { name: menuName });
    await user.click(trigger);
    await user.click(screen.getByLabelText('Document body'));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Document body')).toHaveFocus();
  });

  it.each(['Export', 'More actions'])('allows Shift+Tab to leave %s without trapping focus', async (menuName) => {
    const { user } = renderHeader();
    const trigger = screen.getByRole('button', { name: menuName });
    await user.click(trigger);
    await waitFor(() => expect(screen.getAllByRole('menuitem')[0]).toHaveFocus());
    await user.tab({ shift: true });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it.each(['Export', 'More actions'])('does not restore stale %s focus after an outside interaction', async (menuName) => {
    const { user } = renderHeader();
    const trigger = screen.getByRole('button', { name: menuName });
    await user.click(trigger);
    await waitFor(() => expect(screen.getAllByRole('menuitem')[0]).toHaveFocus());
    const outside = screen.getByRole('button', { name: 'Outside' });
    act(() => {
      screen.getByLabelText('Document body').focus();
      fireEvent.pointerDown(outside);
      outside.focus();
    });
    await act(async () => { await Promise.resolve(); });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(outside).toHaveFocus();
  });

  it('opens the export menu, closes it on outside click and escape, and runs export actions', async () => {
    const { onDownloadCurrent, onExportMarkdown, onPrintPDF, user } = renderHeader();
    const exportButton = screen.getByRole('button', { name: /export/i });

    await user.click(exportButton);
    expect(screen.getByText(/^export$/i, { selector: 'h4' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /outside/i }));
    expect(screen.queryByText(/^export$/i, { selector: 'h4' })).not.toBeInTheDocument();

    await user.click(exportButton);
    expect(screen.getByText(/^export$/i, { selector: 'h4' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText(/^export$/i, { selector: 'h4' })).not.toBeInTheDocument();

    await user.click(exportButton);
    await user.click(screen.getByRole('menuitem', { name: /export \.docx/i }));
    expect(onDownloadCurrent).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/^export$/i, { selector: 'h4' })).not.toBeInTheDocument();

    await user.click(exportButton);
    await user.click(screen.getByRole('menuitem', { name: /save as markdown/i }));
    expect(onExportMarkdown).toHaveBeenCalledTimes(1);

    await user.click(exportButton);
    await user.click(screen.getByRole('menuitem', { name: /print as pdf/i }));
    expect(onPrintPDF).toHaveBeenCalledTimes(1);
  });

  it('opens the utility menu, exposes the overflow icon, and runs utility actions', async () => {
    const { onLoadSample, onReload, onSaveAs, user } = renderHeader();
    const moreButton = screen.getByRole('button', { name: /more actions/i });

    expect(moreButton.querySelector('.more-icon')).not.toBeNull();

    await user.click(moreButton);
    expect(screen.getByText(/more actions/i)).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /save as copy/i }));
    expect(onSaveAs).toHaveBeenCalledTimes(1);

    await user.click(moreButton);
    await user.click(screen.getByRole('menuitem', { name: /load sample/i }));
    expect(onLoadSample).toHaveBeenCalledTimes(1);

    await user.click(moreButton);
    await user.click(screen.getByRole('menuitem', { name: /reload current document/i }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('exposes documentation, changelog and the home page in the More actions menu', async () => {
    const { onShowChangelog, onShowDocs, onShowHome, user } = renderHeader();
    const moreButton = screen.getByRole('button', { name: /more actions/i });

    await user.click(moreButton);
    expect(screen.getByText(/^help$/i, { selector: 'h4' })).toBeInTheDocument();
    // Refresh Map lives in the menu now that the toolbar stays a single row.
    expect(screen.getByRole('menuitem', { name: /refresh map/i })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /^documentation$/i }));
    expect(onShowDocs).toHaveBeenCalledTimes(1);

    await user.click(moreButton);
    await user.click(screen.getByRole('menuitem', { name: /^changelog$/i }));
    expect(onShowChangelog).toHaveBeenCalledTimes(1);

    await user.click(moreButton);
    await user.click(screen.getByRole('menuitem', { name: /home page/i }));
    expect(onShowHome).toHaveBeenCalledTimes(1);
  });

  it('disables reload in the utility menu when reloading is unavailable', async () => {
    const { user } = renderHeader({ canReload: false });

    await user.click(screen.getByRole('button', { name: /more actions/i }));
    expect(screen.getByRole('menuitem', { name: /reload current document/i })).toBeDisabled();
  });

  it('renders the theme toggle and invokes the handler', async () => {
    const { onToggleTheme, user } = renderHeader();

    const themeButton = screen.getByRole('button', { name: /switch to dark theme/i });
    expect(themeButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(themeButton);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('reflects the active dark theme on the toggle', () => {
    renderHeader({ theme: 'dark' });

    const themeButton = screen.getByRole('button', { name: /switch to light theme/i });
    expect(themeButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders the mode picker as a segmented control and switches modes', async () => {
    const onEditorModeChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Header
        showSidebar
        onToggleSidebar={vi.fn()}
        showInfo
        onToggleInfo={vi.fn()}
        theme="light"
        onToggleTheme={vi.fn()}
        documentName="Quarterly Report.docx"
        onDocumentNameChange={vi.fn()}
        isDirty={false}
        apiStatus="connected"
        onLoadSample={vi.fn()}
        onReload={vi.fn()}
        canReload
        onFileChange={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onDownloadCurrent={vi.fn()}
        isSaving={false}
        onRefresh={vi.fn()}
        sourceKind="sample"
        onExportMarkdown={vi.fn()}
        onPrintPDF={vi.fn()}
        editorMode="editing"
        onEditorModeChange={onEditorModeChange}
      />,
    );

    const group = screen.getByRole('radiogroup', { name: /editing mode/i });
    expect(group).toBeInTheDocument();

    const editingOption = screen.getByRole('radio', { name: /editing/i });
    expect(editingOption).toHaveAttribute('aria-checked', 'true');

    const viewingOption = screen.getByRole('radio', { name: /viewing/i });
    expect(viewingOption).toHaveAttribute('aria-checked', 'false');

    await user.click(viewingOption);
    expect(onEditorModeChange).toHaveBeenCalledWith('viewing');
  });

  it('shows the group label and per-mode tooltips', () => {
    renderHeader();

    expect(screen.getByText(/^mode$/i)).toBeInTheDocument();

    expect(screen.getByTitle('Edit document content directly')).toBeInTheDocument();
    expect(
      screen.getByTitle('Propose changes as suggestions without altering the text'),
    ).toBeInTheDocument();
    expect(screen.getByTitle('Read-only preview of the document')).toBeInTheDocument();
  });
});
