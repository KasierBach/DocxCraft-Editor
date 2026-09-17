import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { listActivity, type ActivityEvent } from '../../lib/accountApi';

export type ActivityDayGroup = {
  day: string;
  events: ActivityEvent[];
};

const ACTIVITY_PAGE_SIZE = 20;

function dayLabel(isoDate: string) {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString();
}

function groupByDay(events: ActivityEvent[]): ActivityDayGroup[] {
  const groups: ActivityDayGroup[] = [];

  for (const event of events) {
    const day = dayLabel(event.createdAt);
    const current = groups.at(-1);

    if (current?.day === day) {
      current.events.push(event);
    } else {
      groups.push({ day, events: [event] });
    }
  }

  return groups;
}

/** Pages the caller's activity feed, newest first, grouped by local day. */
export function useAccountActivity() {
  const query = useInfiniteQuery({
    queryKey: ['account', 'activity'],
    queryFn: ({ pageParam }) => listActivity(pageParam, ACTIVITY_PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const events = useMemo(
    () => query.data?.pages.flatMap((page) => page.events) ?? [],
    [query.data],
  );

  return {
    events,
    groups: useMemo(() => groupByDay(events), [events]),
    hasMore: query.hasNextPage,
    fetchMore: () => void query.fetchNextPage(),
    isError: query.isError,
    isLoading: query.isLoading,
    retry: () => void query.refetch(),
  };
}
