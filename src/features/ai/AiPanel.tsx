import { useCallback, useMemo, useState, type RefObject } from 'react';
import { AgentChatLog, AgentComposer, AgentSuggestionChip, useDocxAgentTools, type AgentMessage, type AgentToolCall } from '@eigenpal/docx-editor-agents/react';
import type { DocxEditorRef } from '@eigenpal/docx-editor-react';

import { streamAiChat, type AiMessage } from '../../lib/workspaceApi';

type AiPanelProps = {
  editorRef: RefObject<DocxEditorRef | null>;
  documentName: string;
  onDocumentChanged: () => void;
  close: () => void;
};

const SUGGESTIONS = [
  { label: 'Rewrite selection', prompt: 'Rewrite the selected text for clarity while preserving its meaning.', requiresSelection: true, apply: true },
  { label: 'Shorten selection', prompt: 'Shorten the selected text by about half without losing key facts.', requiresSelection: true, apply: true },
  { label: 'Translate selection', prompt: 'Translate the selected text to Vietnamese and keep names and numbers unchanged.', requiresSelection: true, apply: true },
  { label: 'Fix grammar', prompt: 'Fix grammar and spelling in the selected text without changing its meaning.', requiresSelection: true, apply: true },
  { label: 'Summarize document', prompt: 'Summarize this document in five concise bullet points.', requiresSelection: false, apply: false },
  { label: 'Explain selection', prompt: 'Explain the selected text in plain language and call out any assumptions.', requiresSelection: false, apply: false },
] as const;

export function AiPanel({ editorRef, documentName, onDocumentChanged, close }: AiPanelProps) {
  const { tools = [], getContext, executeToolCall } = useDocxAgentTools({ editorRef, author: 'DocxCraft AI' });
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appendMessage = useCallback((message: AgentMessage) => {
    setMessages((current) => [...current, message]);
  }, []);

  const send = useCallback(
    async (prompt: string, applyToSelection = false) => {
      const trimmed = prompt.trim();
      if (!trimmed || isLoading) return;
      const context = getContext();
      const selection = context.selection;
      const history: AiMessage[] = messages.map(({ role, text }) => ({ role, content: text }));
      history.push({ role: 'user', content: trimmed });
      appendMessage({ id: `user-${Date.now()}`, role: 'user', text: trimmed, status: 'done' });
      const assistantId = `assistant-${Date.now()}`;
      appendMessage({ id: assistantId, role: 'assistant', text: '', status: 'streaming' });
      setInput('');
      setError(null);
      setIsLoading(true);
      let answer = '';
      try {
        await streamAiChat(
          history,
          {
            selection: selection?.selectedText,
            paragraph: selection?.paragraphText,
            documentName,
          },
          (text) => {
            answer += text;
            setMessages((current) => current.map((message) => (message.id === assistantId ? { ...message, text: answer } : message)));
          },
        );
        setMessages((current) => current.map((message) => (message.id === assistantId ? { ...message, text: answer, status: 'done' } : message)));
        if (applyToSelection && selection?.paraId && selection.selectedText && answer.trim()) {
          const toolCall: AgentToolCall = {
            id: `suggest-${Date.now()}`,
            name: 'suggest_change',
            input: { paraId: selection.paraId, search: selection.selectedText, replaceWith: answer.trim() },
            status: 'running',
          };
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, toolCalls: [...(message.toolCalls ?? []), toolCall] } : message));
          const result = executeToolCall('suggest_change', toolCall.input as Record<string, unknown>);
          setMessages((current) => current.map((message) => message.id === assistantId ? {
            ...message,
            toolCalls: message.toolCalls?.map((call) => call.id === toolCall.id ? { ...call, status: result.success ? 'done' : 'error', result: result.success ? String(result.data ?? 'Change proposed.') : undefined, error: result.success ? undefined : String(result.error ?? 'Change failed.') } : call),
          } : message));
          onDocumentChanged();
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'AI request failed.';
        setError(message);
        setMessages((current) => current.map((entry) => (entry.id === assistantId ? { ...entry, status: 'done', text: message } : entry)));
      } finally {
        setIsLoading(false);
      }
    },
    [appendMessage, documentName, executeToolCall, getContext, isLoading, messages, onDocumentChanged],
  );

  const context = getContext();
  const selectionAvailable = Boolean(context.selection?.selectedText);
  const toolNames = tools.map((tool) => tool.function.name);
  const emptyState = useMemo(
    () => <p className="ai-panel__empty">Ask about this document or select text for a tracked rewrite.</p>,
    [],
  );

  return (
    <section className="ai-panel" aria-label="AI assistant">
      <div className="ai-panel__toolbar">
        <span className="ai-panel__title">Assistant</span>
        <button type="button" className="action-button action-button--icon" onClick={close} aria-label="Close assistant">×</button>
      </div>
      <div className="ai-panel__context" aria-live="polite">
        {selectionAvailable ? 'Selection ready for tracked edits.' : 'Using the whole document context.'}
      </div>
      <div className="ai-panel__suggestions">
        {SUGGESTIONS.map(({ label, prompt, requiresSelection, apply }) => (
          <AgentSuggestionChip key={label} label={label} disabled={(requiresSelection && !selectionAvailable) || isLoading} onClick={() => void send(prompt, apply)} />
        ))}
      </div>
      <details className="ai-panel__tools">
        <summary>Document tools ({toolNames.length})</summary>
        <div className="ai-panel__tool-list">
          {toolNames.map((name) => <span key={name}>{name.replaceAll('_', ' ')}</span>)}
        </div>
      </details>
      <AgentChatLog
        messages={messages}
        loading={isLoading}
        error={error}
        emptyState={emptyState}
        className="ai-panel__log"
      />
      <AgentComposer
        value={input}
        onChange={setInput}
        onSubmit={() => void send(input)}
        disabled={isLoading}
        placeholder="Ask about this document…"
        sendLabel="Send"
        footnote="AI is off until an operator configures a server-side key."
      />
    </section>
  );
}
