import type { ConvexReactClient } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { sameHandoff, type HandoffTicket, type PendingHandoff } from './handoff';
import { clearRecoveredHandoff, listPendingHandoffs } from './handoff-store';

const cancelRef = makeFunctionReference<
  'action',
  { ticket: HandoffTicket; phase: 'cancel' },
  unknown
>('inbox/staffHandoff:exchange');
export type OwnerRecoveryState =
  | 'cancelled'
  | 'review_required'
  | 'storage_failed'
  | 'revocation_unconfirmed'
  | 'reauthenticate'
  | 'authority_changed';

/** Root-owned cancellation only; the server derives the actual authenticated owner. */
export function createOwnerRecovery(actorId: string, convex: Pick<ConvexReactClient, 'action'>) {
  return {
    load: () => listPendingHandoffs(actorId),
    async cancel(expected: PendingHandoff): Promise<{ state: OwnerRecoveryState }> {
      let saved: PendingHandoff[];
      try {
        saved = await listPendingHandoffs(actorId);
      } catch {
        return { state: 'storage_failed' };
      }
      const captured = saved.find(p => sameHandoff(p, expected));
      if (!captured) return { state: 'review_required' };
      let reply: unknown;
      try {
        reply = await convex.action(cancelRef, { phase: 'cancel', ticket: captured.ticket });
      } catch {
        return { state: 'revocation_unconfirmed' };
      }
      const state = reply && typeof reply === 'object' && 'state' in reply ? reply.state : null;
      if (state === 'reauthenticate' || state === 'authority_changed') return { state };
      if (state !== 'cancelled') return { state: 'revocation_unconfirmed' };
      try {
        await clearRecoveredHandoff(actorId, captured);
      } catch {
        return { state: 'storage_failed' };
      }
      return { state: 'cancelled' };
    },
  };
}
