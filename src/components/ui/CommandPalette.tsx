import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SavedDocumentSummary } from '../../lib/documentApi';
import { useModalDialog } from '../../hooks/useModalDialog';

type CommandAction = {
  id: string;
  label: string;
  section: string;
  handler: () => void;
};

type CommandResult = {
  id: string;
  label: string;
  type: 'document' | 'anchor' | 'action';
  section: string;
};

type CommandPaletteProps = {
  isOpen: boolean;
  onClose: () => void;
  documents: SavedDocumentSummary[];
  anchors: { id: string; label: string }[];
  actions: CommandAction[];
  onOpenDocument: (documentId: string) => void;
  onJumpToAnchor: (anchorId: string) => void;
};

export function CommandPalette({
  isOpen,
  onClose,
  documents,
  anchors,
  actions,
  onOpenDocument,
  onJumpToAnchor,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useModalDialog({
    isOpen,
    onClose,
    initialFocusRef: inputRef,
    onClosed: () => setQuery(''),
  });

  const filteredResults = useMemo<CommandResult[]>(() => {
    const normalizedQuery = query.toLowerCase().trim();
    const actionResults: CommandResult[] = actions
      .filter((action) => action.label.toLowerCase().includes(normalizedQuery))
      .map((action) => ({ ...action, type: 'action' }));
    const documentResults: CommandResult[] = documents
      .filter((document) => document.name.toLowerCase().includes(normalizedQuery))
      .map((document) => ({
        id: document.id,
        label: document.name,
        type: 'document',
        section: 'Documents',
      }));
    const anchorResults: CommandResult[] = anchors
      .filter((anchor) => anchor.label.toLowerCase().includes(normalizedQuery))
      .slice(0, 8)
      .map((anchor) => ({
        id: anchor.id,
        label: anchor.label,
        type: 'anchor',
        section: 'Outline',
      }));

    return [...actionResults, ...documentResults, ...anchorResults];
  }, [actions, anchors, documents, query]);

  const handleSelect = useCallback(
    (item: CommandResult) => {
      if (item.type === 'document') onOpenDocument(item.id);
      else if (item.type === 'anchor') onJumpToAnchor(item.id);
      else actions.find((action) => action.id === item.id)?.handler();
      onClose();
    },
    [actions, onClose, onJumpToAnchor, onOpenDocument],
  );

  // Reset the highlighted index whenever the result set changes (query,
  // actions, documents, anchors). Adjusting state during render (the pattern
  // documented by React) avoids a setState-in-effect round trip.
  const queryKey = `${query}|${actions.length}|${documents.length}|${anchors.length}`;
  const [lastQueryKey, setLastQueryKey] = useState(queryKey);
  if (lastQueryKey !== queryKey) {
    setLastQueryKey(queryKey);
    setSelectedIndex(0);
  }

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % Math.max(1, filteredResults.length));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(
          (index) => (index - 1 + filteredResults.length) % Math.max(1, filteredResults.length),
        );
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const selected = filteredResults[selectedIndex];
        if (selected) handleSelect(selected);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredResults, handleSelect, isOpen, selectedIndex]);

  if (!isOpen) return null;

  const activeOptionId = filteredResults[selectedIndex]
    ? `command-option-${filteredResults[selectedIndex].type}-${filteredResults[selectedIndex].id}`
    : undefined;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="command-palette modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onKeyDown={(event) => {
          // The input is the only tab stop: keep Tab inside the dialog so
          // focus never escapes into the inert background.
          if (event.key === 'Tab') {
            event.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        <h2 id="command-palette-title" className="visually-hidden">
          Command palette
        </h2>
        <div className="command-palette__input-wrapper">
          <span className="command-palette__icon" aria-hidden="true">/</span>
          <input
            ref={inputRef}
            className="command-palette__input"
            placeholder="Search documents, outline, or commands"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            role="combobox"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            aria-activedescendant={activeOptionId}
            aria-expanded="true"
          />
        </div>

        <div className="command-palette__results">
          {filteredResults.length === 0 ? (
            <p className="command-palette__empty" aria-live="polite">
              No results for &quot;{query}&quot;
            </p>
          ) : (
            <div id="command-palette-results" className="command-palette__list" role="listbox">
              {filteredResults.map((item, index) => {
                const optionId = `command-option-${item.type}-${item.id}`;
                return (
                  <button
                    id={optionId}
                    key={optionId}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === selectedIndex}
                    className={`command-palette__item ${index === selectedIndex ? 'command-palette__item--selected' : ''}`}
                    onMouseMove={() => setSelectedIndex(index)}
                    onClick={() => handleSelect(item)}
                  >
                    <span className="command-palette__item-type">{item.section}</span>
                    <span className="command-palette__item-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="command-palette__footer" aria-hidden="true">
          <span>Arrow keys navigate</span>
          <span>Enter selects</span>
          <span>Esc closes</span>
        </div>
      </section>
    </div>
  );
}
