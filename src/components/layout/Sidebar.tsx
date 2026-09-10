import { Panel } from '../ui/Panel';
import { AnchorNavigator } from '../AnchorNavigator';
import type { AnchorTarget } from '../../lib/anchors';

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
}: SidebarProps) {
  const isFiltered = searchQuery !== '' || filterStyle !== 'outline';

  return (
    <aside className="sidebar" aria-label="Document outline">
      <Panel title="Document outline">
        <div className="filter-group">
          <input
            type="search"
            placeholder="Search outline"
            className="filter-input"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search document outline"
          />
          <select
            className="filter-select"
            value={filterStyle}
            onChange={(event) => onStyleChange(event.target.value)}
            aria-label="Filter outline by style"
          >
            <option value="outline">Outline</option>
            <option value="all">All paragraphs</option>
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
              aria-label="Clear outline filters"
            >
              &times;
            </button>
          )}
        </div>
        <p className="panel-copy">
          {isFiltered
            ? `Found ${filteredAnchors.length} matches.`
            : `Showing ${filteredAnchors.length} of ${anchors.length} paragraphs.`}
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