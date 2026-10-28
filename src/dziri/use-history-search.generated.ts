'use client';
import { useEffect, useRef, useState } from 'react';
type Status = 'LoadingFirstPage' | 'LoadingMore' | 'CanLoadMore' | 'Exhausted';
const BATCH = 300;
/** Search bounded pages; incomplete history must never become a false no-results state. */
export function useHistorySearch(
  query: string,
  active: boolean,
  status: Status,
  count: number,
  loadMore: (size: number) => void,
) {
  const identity = active && query.trim().length >= 2 ? query.trim() : '';
  const [budget, setBudget] = useState({ identity, limit: count + BATCH });
  const attempted = useRef('');
  useEffect(() => {
    if (budget.identity !== identity) {
      setBudget({ identity, limit: count + BATCH });
      attempted.current = '';
    }
  }, [identity, budget.identity, count]);
  const limit = budget.identity === identity ? budget.limit : count + BATCH;
  const paused = !!identity && count >= limit && status === 'CanLoadMore';
  useEffect(() => {
    if (!identity || status !== 'CanLoadMore' || count >= limit) return;
    const request = `${identity}:${count}:${limit}`;
    if (attempted.current === request) return;
    attempted.current = request;
    loadMore(50);
  }, [identity, status, count, limit, loadMore]);
  return {
    complete: status === 'Exhausted',
    paused,
    scanning: !!identity && !paused && status !== 'Exhausted',
    continueSearch: () => setBudget({ identity, limit: count + BATCH }),
  };
}
