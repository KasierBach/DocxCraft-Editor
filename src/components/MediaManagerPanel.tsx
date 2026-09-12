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
      <div className="media-list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="saved-document-card"
            onClick={() => onJumpToParaId(item.paraId)}
          >
            <div className="media-list__row">
              <span className="media-list__icon" aria-hidden="true">
                {item.type === 'image' ? '🖼️' : '📊'}
              </span>
              <div className="media-list__column">
                <span className="saved-document-card__name media-list__label">
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
