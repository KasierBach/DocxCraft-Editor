import { useEffect, useMemo, useState } from 'react';
import type { SavedDocumentSummary } from '../../lib/documentApi';

type CommandAction = {
  id: string;
  label: string;
  section: string;
  icon?: string;
  handler: () => void;
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

  const filteredResults = useMemo(() => {
    const q = query.toLowerCase().trim();
    
    const docResults = documents
      .filter(d => d.name.toLowerCase().includes(q))
      .map(d => ({ id: d.id, label: d.name, type: 'document', section: 'Documents' }));

    const anchorResults = anchors
      .filter(a => a.label.toLowerCase().includes(q))
      .slice(0, 5) // Limit anchors to prevent clutter
      .map(a => ({ id: a.id, label: a.label, type: 'anchor', section: 'Headings' }));

    const actionResults = actions
      .filter(a => a.label.toLowerCase().includes(q))
      .map(a => ({ id: a.id, label: a.label, type: 'action', section: 'Actions' }));

    return [...actionResults, ...docResults, ...anchorResults];
  }, [query, documents, anchors, actions]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredResults.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredResults.length) % Math.max(1, filteredResults.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredResults[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredResults, selectedIndex, onClose]);

  const handleSelect = (item: any) => {
    if (item.type === 'document') onOpenDocument(item.id);
    else if (item.type === 'anchor') onJumpToAnchor(item.id);
    else if (item.type === 'action') {
      const action = actions.find(a => a.id === item.id);
      action?.handler();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="command-palette modal-content" onClick={e => e.stopPropagation()}>
        <div className="command-palette__input-wrapper">
          <span className="command-palette__icon">🔍</span>
          <input
            autoFocus
            className="command-palette__input"
            placeholder="Search documents, headings, or commands..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="command-palette__results">
          {filteredResults.length === 0 ? (
            <div className="command-palette__empty">No results found for "{query}"</div>
          ) : (
            <div className="command-palette__list">
              {filteredResults.map((item, index) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`command-palette__item ${index === selectedIndex ? 'command-palette__item--selected' : ''}`}
                  onClick={() => handleSelect(item)}
                >
                  <span className="command-palette__item-type">{item.section}</span>
                  <span className="command-palette__item-label">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="command-palette__footer">
          <span>↑↓ to navigate</span>
          <span>↵ to select</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  );
}
