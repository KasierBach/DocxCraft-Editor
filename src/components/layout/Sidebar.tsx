import { Panel } from '../ui/Panel';
import { DrawerCloseButton } from '../ui/DrawerCloseButton';
import { AnchorNavigator } from '../AnchorNavigator';
import type { AnchorTarget } from '../../lib/anchors';
import { useTranslation } from '../../i18n';

type SidebarProps = {
  anchors: AnchorTarget[];
  filteredAnchors: AnchorTarget[];
  activeParaId: string | null;
  onJump: (paraId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterStyle: string;
  onStyleChange: (style: string) => void;
  uniqueStyles: string[];
  onResetFilters: () => void;
  onClose?: () => void;
};

export function Sidebar({
  anchors,
  filteredAnchors,
  activeParaId,
  onJump,
  searchQuery,
  onSearchChange,
  filterStyle,
  onStyleChange,
  uniqueStyles,
  onResetFilters,
  onClose,
}: SidebarProps) {
  const { t } = useTranslation();
  const isFiltered = searchQuery !== '' || filterStyle !== 'outline';

  return (
    <aside className="sidebar" aria-label={t('outline.regionLabel')}>
      {onClose && <DrawerCloseButton ariaLabel={t('outline.closeLabel')} onClick={onClose} />}
      <Panel title={t('outline.panelTitle')}>
        <div className="filter-group">
          <input
            type="search"
            placeholder={t('outline.searchPlaceholder')}
            className="filter-input"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label={t('outline.searchLabel')}
          />
          <select
            className="filter-select"
            value={filterStyle}
            onChange={(event) => onStyleChange(event.target.value)}
            aria-label={t('outline.filterLabel')}
          >
            <option value="outline">{t('outline.filterOutline')}</option>
            <option value="all">{t('outline.filterAll')}</option>
            {uniqueStyles.map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
          {isFiltered && (
            <button
              type="button"
              className="filter-reset"
              onClick={onResetFilters}
              aria-label={t('outline.clearFilters')}
            >
              &times;
            </button>
          )}
        </div>
        <p className="panel-copy">
          {isFiltered
            ? t('outline.foundMatches', { count: filteredAnchors.length })
            : t('outline.showing', { shown: filteredAnchors.length, total: anchors.length })}
        </p>
        <AnchorNavigator
          anchors={filteredAnchors}
          activeParaId={activeParaId}
          onJump={onJump}
        />
      </Panel>
    </aside>
  );
}