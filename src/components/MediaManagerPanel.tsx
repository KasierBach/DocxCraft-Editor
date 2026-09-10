import { Panel } from './ui/Panel';
import type { MediaItem } from '../lib/mediaScanner';

type MediaManagerPanelProps = {
  items: MediaItem[];
  onJumpToParaId: (paraId: string) => void;
};

export function MediaManagerPanel({ items, onJumpToParaId }: MediaManagerPanelProps) {
  if (items.length === 0) {
    return (
      <Panel title="Media Manager">
        <p className="panel-copy">No images or tables found in this document.</p>
      </Panel>
    );
  }

  return (
    <Panel title={`Media Manager (${items.length})`}>
      <div className="media-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="saved-document-card"
            style={{ textAlign: 'left', padding: '8px 12px' }}
            onClick={() => onJumpToParaId(item.paraId)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>
                {item.type === 'image' ? '🖼️' : '📊'}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="saved-document-card__name" style={{ fontSize: '0.75rem' }}>
                  {item.label}
                </span>
                <span className="saved-document-card__meta">
                  Paragraph {item.paragraphIndex}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Panel>
  );
}
