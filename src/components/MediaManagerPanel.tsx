import { Panel } from './ui/Panel';
import type { MediaItem } from '../lib/mediaScanner';
import { useTranslation } from '../i18n';

type MediaManagerPanelProps = {
  items: MediaItem[];
  onJumpToMedia: (item: MediaItem) => void;
};

export function MediaManagerPanel({ items, onJumpToMedia }: MediaManagerPanelProps) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <Panel title={t('documents.mediaTitle')}>
        <p className="panel-copy">{t('documents.mediaEmpty')}</p>
      </Panel>
    );
  }

  return (
    <Panel title={t('documents.mediaTitleCount', { count: items.length })}>
      <div className="media-list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="saved-document-card"
            onClick={() => onJumpToMedia(item)}
          >
            <span className="media-list__row">
              <span className="media-list__icon" aria-hidden="true">
                {item.type === 'image' ? '🖼️' : '📊'}
              </span>
              <span className="media-list__column">
                <span className="saved-document-card__name media-list__label">
                  {item.label}
                </span>
                <span className="saved-document-card__meta">
                  {t('documents.paragraph', { index: item.paragraphIndex })}
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}
