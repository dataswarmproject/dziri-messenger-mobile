import { useEffect, useMemo, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { createOutbox, type OutgoingDraft } from './outbox';
import { useLocalMessages, registerLocalMessageQueue } from './local-messages';
import type { MarketplaceWriteScope, PersonalWriteScope } from './message-writes.generated';
export function useOutbox(
  transmit: (draft: OutgoingDraft) => Promise<unknown>,
  confirmed: string[],
  scope?: string,
  marketplaceScope?: MarketplaceWriteScope,
  personalScope?: PersonalWriteScope,
) {
  const vault = useLocalMessages();
  const [attempt, setAttempt] = useState(0);
  const hydrated = useRef(false),
    mounted = useRef(true);
  const currentConfirmed = useRef(confirmed);
  currentConfirmed.current = confirmed;
  const [state, setState] = useState<{ owner: symbol | null; rows: OutgoingDraft[] }>({
    owner: null,
    rows: [],
  });
  const [recovery, setRecovery] = useState<{
    owner: symbol | null;
    ready: boolean;
    failed: boolean;
  }>({ owner: null, ready: false, failed: false });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { outbox, owner } = useMemo(() => {
    const owner = Symbol('outbox-scope');
    const outbox = createOutbox(
      transmit,
      randomUUID,
      value => {
        if (mounted.current) setState({ owner, rows: value });
        if (vault && scope && hydrated.current)
          void vault
            .then(store => store.save(scope, { pending: value }))
            .catch(() => {
              if (mounted.current)
                setRecovery(prior => (prior.owner === owner ? { ...prior, failed: true } : prior));
            });
      },
      Date.now,
      vault && scope
        ? value => vault.then(store => store.save(scope, { pending: value }))
        : undefined,
      marketplaceScope,
      personalScope,
      vault && scope
        ? expected => vault.then(store => store.removePending(scope, expected))
        : undefined,
    );
    return { outbox, owner };
  }, [transmit, vault, scope, marketplaceScope, personalScope]);
  useEffect(() => {
    outbox.activate();
    const unregister = registerLocalMessageQueue(outbox.deactivate);
    return () => {
      outbox.deactivate();
      unregister();
    };
  }, [outbox]);
  useEffect(() => {
    let active = true;
    hydrated.current = !vault || !scope;
    setRecovery({ owner, ready: hydrated.current, failed: false });
    if (vault && scope)
      void vault
        .then(store => store.read(scope))
        .then(saved => {
          if (!active) return;
          outbox.restore(saved.pending.filter(row => !currentConfirmed.current.includes(row.id)));
          hydrated.current = true;
          setRecovery({ owner, ready: true, failed: false });
        })
        .catch(() => {
          if (active) setRecovery({ owner, ready: false, failed: true });
        });
    return () => {
      active = false;
      hydrated.current = false;
    };
  }, [vault, scope, outbox, owner, attempt]);
  useEffect(() => outbox.acknowledge(confirmed), [outbox, confirmed]);
  const ready = recovery.owner === owner && recovery.ready;
  return {
    drafts: state.owner === owner ? state.rows : [],
    ready,
    cacheFailed: recovery.owner === owner && recovery.failed,
    retryRecovery: () => setAttempt(value => value + 1),
    enqueue: (...args: Parameters<typeof outbox.enqueue>) => ready && outbox.enqueue(...args),
    enqueueMedia: (...args: Parameters<typeof outbox.enqueueMedia>) =>
      ready && outbox.enqueueMedia(...args),
    enqueueSticker: (...args: Parameters<typeof outbox.enqueueSticker>) =>
      ready && outbox.enqueueSticker(...args),
    retry: (id: string) => {
      if (ready) outbox.retry(id);
    },
    discard: (expected: OutgoingDraft) =>
      ready ? outbox.discard(expected) : Promise.resolve(false),
  };
}
