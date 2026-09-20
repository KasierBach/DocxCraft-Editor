import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const agentState = vi.hoisted(() => ({
  context: { selection: undefined as { paraId: string; selectedText: string; paragraphText: string } | undefined },
  executeToolCall: vi.fn(() => ({ success: true, data: 'Change proposed.' })),
}));

vi.mock('@eigenpal/docx-editor-agents/react', () => ({
  useDocxAgentTools: () => ({
    getContext: () => agentState.context,
    executeToolCall: agentState.executeToolCall,
  }),
  AgentSuggestionChip: ({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) => (
    <button type="button" disabled={disabled} onClick={onClick}>{label}</button>
  ),
  AgentChatLog: ({ messages, emptyState }: { messages: Array<{ role: string; text: string }>; emptyState: React.ReactNode }) => (
    <div aria-label="chat-log">{messages.length ? messages.map((message) => <p key={`${message.role}-${message.text}`}>{message.text}</p>) : emptyState}</div>
  ),
  AgentComposer: ({ value, onChange, onSubmit, disabled }: { value: string; onChange: (value: string) => void; onSubmit: () => void; disabled?: boolean }) => (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <input aria-label="AI prompt" value={value} onChange={(event) => onChange(event.target.value)} />
      <button type="submit" disabled={disabled}>Send</button>
    </form>
  ),
}));

vi.mock('../../../lib/workspaceApi', () => ({ streamAiChat: vi.fn() }));

import { AiPanel } from '../AiPanel';
import { streamAiChat } from '../../../lib/workspaceApi';

describe('AiPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentState.context = { selection: undefined };
    vi.mocked(streamAiChat).mockImplementation(async (_messages, _context, onText) => {
      onText('Answer');
    });
  });

  it('sends a document question, renders the streamed answer, and closes', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    renderPanel(close);

    expect(screen.getByText(/ask about this document/i)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'AI prompt' }), 'Summarize this');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Answer')).toBeInTheDocument());
    expect(streamAiChat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Summarize this' }],
      { selection: undefined, paragraph: undefined, documentName: 'Report.docx' },
      expect.any(Function),
    );
    await user.click(screen.getByRole('button', { name: 'Close assistant' }));
    expect(close).toHaveBeenCalledOnce();
  });

  it('applies a selection suggestion through the tracked tool and reports a document change', async () => {
    agentState.context = { selection: { paraId: 'p1', selectedText: 'old text', paragraphText: 'old text in paragraph' } };
    const user = userEvent.setup();
    const onDocumentChanged = vi.fn();
    renderPanel(vi.fn(), onDocumentChanged);

    await user.click(screen.getByRole('button', { name: 'Rewrite selection' }));

    await waitFor(() => expect(agentState.executeToolCall).toHaveBeenCalledWith('suggest_change', {
      paraId: 'p1',
      search: 'old text',
      replaceWith: 'Answer',
    }));
    expect(onDocumentChanged).toHaveBeenCalledOnce();
    expect(screen.getByText('Answer')).toBeInTheDocument();
  });

  it('surfaces a provider error without crashing the panel', async () => {
    vi.mocked(streamAiChat).mockRejectedValueOnce(new Error('AI unavailable'));
    const user = userEvent.setup();
    renderPanel(vi.fn());

    await user.type(screen.getByRole('textbox', { name: 'AI prompt' }), 'Try again');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('AI unavailable')).toBeInTheDocument();
  });
});

function renderPanel(close: () => void, onDocumentChanged = vi.fn()) {
  return render(
    <AiPanel
      editorRef={{ current: null }}
      documentName="Report.docx"
      onDocumentChanged={onDocumentChanged}
      close={close}
    />,
  );
}
