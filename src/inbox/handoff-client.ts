import type { ConvexReactClient } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import type { StaffWorkspace } from '../dziri/messenger-staff.generated';
import type { Session } from './client';
import { StaffHandoff, type HandoffExchangeRequest } from './handoff';
import { loadPendingHandoff, savePendingHandoff } from './handoff-store';

const prepare = makeFunctionReference<
  'action',
  { companyId: string; authorityKey: string },
  unknown
>('inbox/staffHandoff:prepare');
const exchange = makeFunctionReference<'action', HandoffExchangeRequest, unknown>(
  'inbox/staffHandoff:exchange',
);

/** Root-owned staff adapter. Personal chat code must never import this module. */
export function createStaffHandoff(
  workspace: StaffWorkspace,
  convex: Pick<ConvexReactClient, 'action'>,
  accept: (session: Session) => Promise<void>,
) {
  const captured = Object.freeze({ ...workspace });
  return new StaffHandoff(captured, {
    prepare: () =>
      convex.action(prepare, {
        companyId: captured.companyId,
        authorityKey: captured.authorityKey,
      }),
    exchange: args => convex.action(exchange, args),
    load: () => loadPendingHandoff(captured),
    save: (pending, expected) => savePendingHandoff(captured, pending, expected),
    accept,
  });
}
