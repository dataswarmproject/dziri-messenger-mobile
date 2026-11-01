import { useEffect, useRef } from 'react';

type Client = { close(): Promise<void> };

/** Retire the connection after React has had a chance to replay its effects.
 * Owners still unsubscribe and cancel their work during ordinary cleanup.
 * A replacement URL/session has its own client and cannot reclaim the old one.
 */
export function useClientRetirement(client: Client) {
  const leases = useRef(new WeakMap<Client, object>());
  useEffect(() => {
    const current = leases.current;
    const lease = {};
    current.set(client, lease);
    return () => {
      queueMicrotask(() => {
        if (current.get(client) !== lease) return;
        current.delete(client);
        void client.close().catch(() => {
          console.warn('Could not finish closing the retired data connection.');
        });
      });
    };
  }, [client]);
}
