import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { MessageVault } from './message-vault';

const LocalMessages = createContext<Promise<MessageVault> | null>(null);
const sessions = new Set<Promise<MessageVault>>();
const queues = new Set<() => void>();
export function registerLocalMessageQueue(suspend: () => void) {
  queues.add(suspend);
  return () => {
    queues.delete(suspend);
  };
}
export async function clearLocalMessageSessions() {
  // Stop transport synchronously, before clearing storage or awaiting sign-out.
  for (const suspend of [...queues]) suspend();
  const current = [...sessions];
  sessions.clear();
  await Promise.allSettled(current.map(async promise => (await promise).clear()));
}
export function LocalMessagesProvider({
  actor,
  deployment,
  children,
}: {
  actor: string;
  deployment: string;
  children: ReactNode;
}) {
  const vault = useMemo(() => {
    const opened = import('./message-vault-storage').then(module =>
      module.openAccountVault(deployment, actor),
    );
    sessions.add(opened);
    return opened;
  }, [deployment, actor]);
  // Keep failures handled even before a conversation subscribes to the provider.
  useEffect(() => {
    void vault.catch(() => {});
  }, [vault]);
  return (
    <LocalMessages.Provider key={JSON.stringify([deployment, actor])} value={vault}>
      {children}
    </LocalMessages.Provider>
  );
}
export const useLocalMessages = () => useContext(LocalMessages);

export function useLocalDraft(scope?: string) {
  const vault = useLocalMessages();
  const [state, setState] = useState({ scope, body: '', ready: !vault || !scope, failed: false });
  const current = useRef(state);
  const sequence = useRef(0),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    sequence.current += 1;
    let active = true;
    const next = { scope, body: '', ready: !vault || !scope, failed: false };
    current.current = next;
    setState(next);
    if (vault && scope)
      void vault
        .then(store => store.read(scope))
        .then(saved => {
          if (!active) return;
          const loaded = { scope, body: saved.body, ready: true, failed: false };
          sequence.current += 1;
          current.current = loaded;
          setState(loaded);
        })
        .catch(() => {
          if (active) {
            const failed = { scope, body: '', ready: true, failed: true };
            current.current = failed;
            setState(failed);
          }
        });
    return () => {
      active = false;
      alive.current = false;
    };
  }, [vault, scope]);
  function setBody(body: string) {
    const prior = current.current;
    if (!alive.current || prior.scope !== scope || !prior.ready) return;
    sequence.current += 1;
    const next = { ...prior, body: body.slice(0, 8000) };
    current.current = next;
    setState(next);
    if (vault && scope)
      void vault
        .then(store => store.save(scope, { body: next.body }))
        .then(() => {
          if (current.current.scope === scope) setState(value => ({ ...value, failed: false }));
        })
        .catch(() => {
          if (current.current.scope === scope) setState(value => ({ ...value, failed: true }));
        });
  }
  return {
    body: state.scope === scope ? state.body : '',
    setBody,
    revision: sequence.current,
    isCurrent(body: string, revision: number) {
      return (
        alive.current &&
        current.current.scope === scope &&
        current.current.ready &&
        current.current.body === body &&
        sequence.current === revision
      );
    },
    clearSent(submitted: string, revision: number) {
      if (
        !alive.current ||
        current.current.scope !== scope ||
        !current.current.ready ||
        current.current.body !== submitted ||
        sequence.current !== revision
      )
        return false;
      setBody('');
      return true;
    },
    ready: state.scope === scope && state.ready,
    failed: state.scope === scope && state.failed,
  };
}
