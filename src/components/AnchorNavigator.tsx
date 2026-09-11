import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnchorTarget } from '../lib/anchors';

type AnchorNavigatorProps = {
  anchors: AnchorTarget[];
  activeParaId: string | null;
  onJump: (paraId: string) => void;
};

export function AnchorNavigator({ anchors, activeParaId, onJump }: AnchorNavigatorProps) {
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [collapsedPages, setCollapsedPages] = useState<Set<number>>(new Set());

  const groupedAnchors = useMemo(() => {
    const groups: Record<number, AnchorTarget[]> = {};
    anchors.forEach((anchor) => {
      if (!groups[anchor.pageNumber]) groups[anchor.pageNumber] = [];
      groups[anchor.pageNumber].push(anchor);
    });
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  }, [anchors]);

  const togglePage = (pageNumber: number) => {
    setCollapsedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
  };

  // Auto-expand the page containing the active anchor. Adjusting state
  // during render (the pattern documented by React) avoids a
  // setState-in-effect round trip; the previous page is tracked in state.
  const activeAnchor = activeParaId
    ? anchors.find((anchor) => anchor.id === activeParaId)
    : undefined;
  const [lastActivePage, setLastActivePage] = useState<number | null>(null);
  if (activeAnchor && lastActivePage !== activeAnchor.pageNumber) {
    setLastActivePage(activeAnchor.pageNumber);
    if (collapsedPages.has(activeAnchor.pageNumber)) {
      const next = new Set(collapsedPages);
      next.delete(activeAnchor.pageNumber);
      setCollapsedPages(next);
    }
  }

  useEffect(() => {
    if (!activeAnchor || collapsedPages.has(activeAnchor.pageNumber)) {
      return;
    }

    activeButtonRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, [activeAnchor, collapsedPages]);

  const collapseAll = () => {
    const allPageNums = groupedAnchors.map(([page]) => Number(page));
    setCollapsedPages(new Set(allPageNums));
  };

  const expandAll = () => {
    setCollapsedPages(new Set());
  };

  if (anchors.length === 0) {
    return <p className="anchor-empty">No matching paragraphs found.</p>;
  }

  return (
    <div
      className="anchor-list"
      aria-label="Paragraph anchors"
    >
      <div className="anchor-list__controls">
        <button type="button" className="control-button" onClick={collapseAll}>
          Collapse All
        </button>
        <button type="button" className="control-button" onClick={expandAll}>
          Expand All
        </button>
      </div>

      {groupedAnchors.map(([page, pageAnchors]) => {
        const pageNum = Number(page);
        const isCollapsed = collapsedPages.has(pageNum);

        return (
          <div key={page} className="anchor-group" data-collapsed={isCollapsed}>
            <button
              type="button"
              className="anchor-group__header"
              onClick={() => togglePage(pageNum)}
            >
              <span className="anchor-group__title">Page {page}</span>
              <span className="anchor-group__toggle-icon">
                {isCollapsed ? '+' : '−'}
              </span>
            </button>
            {!isCollapsed && (
              <div className="anchor-group__content">
                {pageAnchors.map((anchor) => (
                  <button
                    key={anchor.id}
                    type="button"
                    className="anchor-button"
                    data-active={anchor.id === activeParaId ? 'true' : 'false'}
                    ref={anchor.id === activeParaId ? activeButtonRef : null}
                    onClick={() => onJump(anchor.id)}
                  >
                    <span className="anchor-button__label">{anchor.label}</span>
                    <div className="anchor-button__meta">
                      <span className="anchor-tag">{anchor.styleId || 'Normal'}</span>
                      <span className="anchor-id">{anchor.id}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
