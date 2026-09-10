import { useCallback, useMemo, useState } from 'react';
import type { AnchorTarget } from '../lib/anchors';

export function useAnchors() {
  const [anchors, setAnchors] = useState<AnchorTarget[]>([]);
  const [activeParaId, setActiveParaId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStyle, setFilterStyle] = useState('outline');

  const filteredAnchors = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const headings = anchors.filter((anchor) => /^Heading\d+$/i.test(anchor.styleId ?? ''));
    const outline = headings.length > 0 ? headings : anchors;

    return (filterStyle === 'outline' ? outline : anchors).filter((anchor) => {
      const matchesSearch =
        !normalizedQuery ||
        anchor.label.toLowerCase().includes(normalizedQuery) ||
        anchor.id.toLowerCase().includes(normalizedQuery);
      const matchesStyle =
        filterStyle === 'outline' || filterStyle === 'all' || anchor.styleId === filterStyle;
      return matchesSearch && matchesStyle;
    });
  }, [anchors, filterStyle, searchQuery]);

  const uniqueStyles = useMemo(() => {
    return Array.from(
      new Set(
        anchors
          .map((anchor) => anchor.styleId)
          .filter((styleId): styleId is string => Boolean(styleId)),
      ),
    );
  }, [anchors]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setFilterStyle('outline');
  }, []);

  return {
    anchors,
    setAnchors,
    filteredAnchors,
    activeParaId,
    setActiveParaId,
    searchQuery,
    setSearchQuery,
    filterStyle,
    setFilterStyle,
    uniqueStyles,
    resetFilters,
  };
}