import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export interface UseVirtualTableOptions<T> {
  items: T[];
  estimatedRowHeight?: number;
  overscan?: number;
}

export interface UseVirtualTableResult<T> {
  containerRef: React.RefCallback<HTMLElement>;
  visibleItems: { item: T; index: number }[];
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  totalHeight: number;
}

/**
 * Lightweight, zero-dependency virtual table hook.
 * Only mounts visible rows + overscan buffer in the DOM, maintaining 60fps scrolling
 * and minimal DOM footprint while preserving 100% identical table styles and layouts.
 */
export function useVirtualTable<T>({
  items,
  estimatedRowHeight = 68,
  overscan = 4,
}: UseVirtualTableOptions<T>): UseVirtualTableResult<T> {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const domNodeRef = useRef<HTMLElement | null>(null);

  const containerRef = useCallback((node: HTMLElement | null) => {
    domNodeRef.current = node;
    if (node) {
      setViewportHeight(node.clientHeight || window.innerHeight);
    }
  }, []);

  useEffect(() => {
    const target = domNodeRef.current;
    if (!target) return;

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        if (target) {
          setScrollTop(target.scrollTop);
        }
        rafId = null;
      });
    };

    const handleResize = () => {
      if (target) {
        setViewportHeight(target.clientHeight || window.innerHeight);
      }
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Initial measurement
    setScrollTop(target.scrollTop);
    setViewportHeight(target.clientHeight || window.innerHeight);

    return () => {
      target.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const totalCount = items.length;
  const totalHeight = totalCount * estimatedRowHeight;

  // If list is small (<= 15 items), render all directly with zero overhead
  if (totalCount <= 15) {
    return {
      containerRef,
      visibleItems: items.map((item, index) => ({ item, index })),
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
      totalHeight,
    };
  }

  const startIndex = Math.max(0, Math.floor(scrollTop / estimatedRowHeight) - overscan);
  const endIndex = Math.min(
    totalCount,
    Math.ceil((scrollTop + viewportHeight) / estimatedRowHeight) + overscan
  );

  const topSpacerHeight = startIndex * estimatedRowHeight;
  const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * estimatedRowHeight);

  const visibleItems = useMemo(() => {
    const slice: { item: T; index: number }[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      slice.push({ item: items[i], index: i });
    }
    return slice;
  }, [items, startIndex, endIndex]);

  return {
    containerRef,
    visibleItems,
    topSpacerHeight,
    bottomSpacerHeight,
    totalHeight,
  };
}
