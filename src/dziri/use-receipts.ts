import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { dziriApi } from './api';
import {
  createReceiptObserver,
  createReactionInboxObserver,
  marketplaceInboxKey,
  type MarketplaceInboxSource,
  receiptScopeKey,
  type ReceiptCommand,
  type ReceiptScope,
} from './message-receipts.generated';
export function useReceiptScope(
  actorId: string | undefined,
  threadId: string,
  supported: boolean,
  online: boolean,
) {
  const prepare = useMutation(dziriApi.receiptPrepare),
    send = useMutation(dziriApi.acknowledgeReceipt);
  const value = useQuery(
    dziriApi.receiptSummary,
    supported && actorId ? { threadId, expectedActorId: actorId } : 'skip',
  );
  const summary = value?.actorId === actorId && value?.threadId === threadId ? value : undefined;
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!supported || !actorId || !online || summary?.tracked) return;
    let live = true,
      timer: ReturnType<typeof setTimeout> | undefined;
    void prepare({ threadId, expectedActorId: actorId }).catch(() => {
      if (live) timer = setTimeout(() => setAttempt(n => n + 1), 1500);
    });
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [actorId, threadId, supported, online, summary?.tracked, prepare, attempt]);
  const scope: ReceiptScope | null = supported && summary?.tracked ? summary : null;
  return { scope, send, summary };
}
export type ExactReceiptAdapter = {
  scope: ReceiptScope | null;
  send: (command: ReceiptCommand) => Promise<unknown>;
  state?: 'inline';
  marketplace?: MarketplaceInboxSource | null;
};
/** Render only for an advertised Marketplace capability; personal threads never query this API. */
export function MarketplaceReactionObserver({
  source,
  active,
}: {
  source: MarketplaceInboxSource;
  active: boolean;
}) {
  const value = useQuery(dziriApi.reactionInbox, active ? source : 'skip');
  const send = useMutation(dziriApi.acknowledgeReactionInbox),
    latest = useRef(send);
  latest.current = send;
  const observer = useRef<ReturnType<typeof createReactionInboxObserver> | null>(null);
  useLayoutEffect(() => {
    const current = createReactionInboxObserver(args => latest.current(args));
    observer.current = current;
    return () => {
      current.dispose();
      if (observer.current === current) observer.current = null;
    };
  }, []);
  const key = marketplaceInboxKey(source);
  const head = value && marketplaceInboxKey(value) === key ? value.headId : null;
  useLayoutEffect(
    () => observer.current?.configure(source, active, head),
    [key, source, active, head],
  );
  return null;
}
export function useReceiptObserver(
  adapter: ExactReceiptAdapter | undefined,
  enabled: boolean,
  incoming: string[],
) {
  const latest = useRef(adapter);
  latest.current = adapter;
  const observer = useRef<ReturnType<typeof createReceiptObserver> | null>(null);
  const visible = useRef<string[]>([]),
    allowed = useRef(new Set(incoming));
  allowed.current = new Set(incoming);
  useLayoutEffect(() => {
    const current = createReceiptObserver(
      command => latest.current?.send(command) ?? Promise.resolve(null),
    );
    observer.current = current;
    return () => {
      current.dispose();
      if (observer.current === current) observer.current = null;
    };
  }, []);
  const key = receiptScopeKey(adapter?.scope),
    ids = JSON.stringify(incoming);
  const identity = adapter?.scope
    ? JSON.stringify([
        adapter.scope.actorId,
        adapter.scope.threadId,
        adapter.scope.epoch,
        ...(adapter.scope.authorityKey ? [adapter.scope.authorityKey] : []),
      ])
    : '';
  const previousIdentity = useRef(identity);
  useLayoutEffect(() => {
    if (previousIdentity.current !== identity) {
      visible.current = [];
      previousIdentity.current = identity;
    }
    observer.current?.configure(adapter?.scope ?? null, enabled);
    observer.current?.received(incoming);
    observer.current?.visible(visible.current.filter(id => allowed.current.has(id)));
  }, [key, enabled, ids, identity, adapter?.scope, incoming]);
  const update = useCallback(
    (ids: string[]) => {
      if (previousIdentity.current !== identity) return;
      visible.current = ids;
      observer.current?.visible(ids.filter(id => allowed.current.has(id)));
    },
    [identity],
  );
  return update;
}
