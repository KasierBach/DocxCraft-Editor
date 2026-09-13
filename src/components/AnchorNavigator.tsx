import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnchorTarget } from '../lib/anchors';
import { useTranslation } from '../i18n';

type AnchorNavigatorProps = {
  anchors: AnchorTarget[];
  activeParaId: string | null;
  onJump: (paraId: string) => void;
};

export function AnchorNavigator({ anchors, activeParaId, onJump }: AnchorNavigatorProps) {
  const { t } = useTranslation();
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [collapsedPages, setCollapsedPages] = useState<Set<number>>(new Set());

  const prefersReducedMotion = useMemo(
    () =>
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
    [],
  );

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
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [activeAnchor, collapsedPages, prefersReducedMotion]);

  const collapseAll = () => {
    const allPageNums = groupedAnchors.map(([page]) => Number(page));
    setCollapsedPages(new Set(allPageNums));
  };

  const expandAll = () => {
    setCollapsedPages(new Set());
  };

  if (anchors.length === 0) {
    return <p className="anchor-empty">{t('outline.noMatches')}</p>;
  }

  return (
    <div
      className="anchor-list"
      aria-label={t('outline.listLabel')}
    >
      <div className="anchor-list__controls">
        <button type="button" className="control-button" onClick={collapseAll}>
          {t('outline.collapseAll')}
        </button>
        <button type="button" className="control-button" onClick={expandAll}>
          {t('outline.expandAll')}
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
              aria-expanded={!isCollapsed}
              aria-controls={`anchor-page-${pageNum}-content`}
            >
              <span className="anchor-group__title">{t('outline.page', { page: pageNum })}</span>
              <span className="anchor-group__toggle-icon" aria-hidden="true">
                {isCollapsed ? '+' : '−'}
              </span>
            </button>
            {!isCollapsed && (
              <div className="anchor-group__content" id={`anchor-page-${pageNum}-content`}>
                {pageAnchors.map((anchor) => (
                  <button
                    key={anchor.id}
                    type="button"
                    className="anchor-button"
                    data-active={anchor.id === activeParaId ? 'true' : 'false'}
                    aria-current={anchor.id === activeParaId ? 'true' : undefined}
                    ref={anchor.id === activeParaId ? activeButtonRef : null}
                    onClick={() => onJump(anchor.id)}
                  >
                    <span className="anchor-button__label">{anchor.label}</span>
                    <span className="anchor-button__meta">
                      <span className="anchor-tag">{anchor.styleId || t('outline.normal')}</span>
                      <span className="anchor-id">{anchor.id}</span>
                    </span>
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
