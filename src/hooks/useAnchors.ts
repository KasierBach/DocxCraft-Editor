import { useState, useMemo, useCallback } from 'react';
import type { AnchorTarget } from '../lib/anchors';

export function useAnchors() {
  const [anchors, setAnchors] = useState<AnchorTarget[]>([]);
  const [activeParaId, setActiveParaId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStyle, setFilterStyle] = useState('all');

  const filteredAnchors = useMemo(() => {
    return anchors.filter((anchor) => {
      const matchesSearch = anchor.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           anchor.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStyle = filterStyle === 'all' || anchor.styleId === filterStyle;
      return matchesSearch && matchesStyle;
    });
  }, [anchors, searchQuery, filterStyle]);

  const uniqueStyles = useMemo(() => {
    const styles = new Set(
      anchors
        .map((anchor) => anchor.styleId)
        .filter((styleId): styleId is string => Boolean(styleId)),
    );
    return Array.from(styles);
  }, [anchors]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setFilterStyle('all');
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
    resetFilters
  };
}
