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
  onResetFilters
}: SidebarProps) {
  const isFiltered = searchQuery !== '' || filterStyle !== 'all';

  return (
    <aside className="sidebar">
      <Panel title="Anchor map">
        <div className="filter-group">
          <input 
            type="text" 
            placeholder="Search headings..." 
            className="filter-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <select 
            className="filter-select"
            value={filterStyle}
            onChange={(e) => onStyleChange(e.target.value)}
          >
            <option value="all">Styles</option>
            {uniqueStyles.map(style => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>
          {isFiltered && (
            <button 
              className="filter-reset" 
              onClick={onResetFilters}
              title="Clear filters"
            >
              ×
            </button>
          )}
        </div>
        <p className="panel-copy">
          {isFiltered 
            ? `Found ${filteredAnchors.length} matches.` 
            : `Showing ${anchors.length} items.`}
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
