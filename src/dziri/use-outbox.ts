import { useEffect, useMemo, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { createOutbox, type OutgoingDraft } from './outbox';
export function useOutbox(
  transmit: (draft: OutgoingDraft) => Promise<unknown>,
  confirmed: string[],
) {
  const [drafts, setDrafts] = useState<OutgoingDraft[]>([]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const outbox = useMemo(
    () =>
      createOutbox(transmit, randomUUID, value => {
        if (mounted.current) setDrafts(value);
      }),
    [transmit],
  );
  useEffect(() => outbox.acknowledge(confirmed), [outbox, confirmed]);
  return { drafts, enqueue: outbox.enqueue, retry: outbox.retry };
}
