'use client';
import { useEffect, useRef, useState } from 'react';
import {
  captureStaffCommand,
  staffCommandPayload,
  staffCommandConfirmed,
  staffCommandCurrent,
  staffPendingQuery,
  validStaffStatus,
  type StaffCommand,
  type StaffPending,
  type StaffPendingQuery,
  type StaffResult,
  type StaffStatus,
} from './messenger-staff.generated';

export type StaffStatusArgs = {
  companyId: string;
  expectedActorId: string;
  pendingCommand?: StaffPendingQuery;
};
export type StaffPhase =
  | 'loading'
  | 'unavailable'
  | 'setup'
  | 'stopped'
  | 'ownerRequired'
  | 'waiting'
  | 'link'
  | 'verify'
  | 'linked'
  | 'working'
  | 'failed'
  | 'review';
export function useStaffSetup({
  actorId,
  companyId,
  locale,
  supported,
  useStatus,
  send,
  hash,
  id,
}: {
  actorId: string;
  companyId: string;
  locale: string;
  supported: boolean;
  useStatus: (args: StaffStatusArgs | 'skip') => StaffStatus | null | undefined;
  send: (command: StaffCommand) => Promise<StaffResult>;
  hash: (payload: string) => Promise<string>;
  id: () => string;
}) {
  const [pending, setPending] = useState<StaffPending | null>(null),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [reviewing, setReviewing] = useState<StaffCommand['kind'] | null>(null);
  const status = useStatus(
    supported && actorId && companyId
      ? {
          companyId,
          expectedActorId: actorId,
          ...(pending ? { pendingCommand: staffPendingQuery(pending) } : {}),
        }
      : 'skip',
  );
  const scope = JSON.stringify([actorId, companyId, supported]),
    alive = useRef(false),
    epoch = useRef(0),
    locked = useRef(false),
    attempt = useRef<StaffCommand | null>(null),
    current = useRef({ status, scope, supported });
  current.current = { status, scope, supported };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      epoch.current++;
    };
  }, []);
  const valid = validStaffStatus(status, actorId, companyId),
    proof =
      pending && staffCommandConfirmed(pending.command, pending.hash, status)
        ? status!.confirmation
        : undefined;
  const original = pending?.command ?? attempt.current;
  const retryable =
    !!original && (proof ? proof.retryable : failed && staffCommandCurrent(original, status));
  let phase: StaffPhase;
  if (!supported) phase = 'unavailable';
  else if (status === undefined) phase = 'loading';
  else if (!valid) phase = 'unavailable';
  else if (busy) phase = 'working';
  else if (
    pending?.command.kind === 'configure' &&
    !pending.command.enabled &&
    proof &&
    !status!.enabled
  )
    phase = 'stopped';
  else if (!status!.available) phase = 'unavailable';
  else if (original && !proof && !staffCommandCurrent(original, status)) phase = 'review';
  else if (proof?.status === 'failed' && !proof.retryable) phase = 'review';
  else if (proof?.status === 'failed' || (failed && !proof)) phase = 'failed';
  else if (pending && (!proof || ['pending', 'processing'].includes(proof.status)))
    phase = 'waiting';
  else if (!status!.enabled)
    phase = status!.canConfigure ? (status!.configured ? 'stopped' : 'setup') : 'ownerRequired';
  else if (!status!.ready) phase = status!.setupCommandState === 'failed' ? 'review' : 'waiting';
  else if (status!.staffReady) phase = 'linked';
  else if (['pending', 'processing'].includes(status!.staffCommandState ?? '')) phase = 'waiting';
  else phase = status!.staffContext ? 'link' : 'verify';
  async function perform(command: StaffCommand, prior?: StaffPending) {
    if (
      !alive.current ||
      locked.current ||
      current.current.scope !== scope ||
      !current.current.supported
    )
      return;
    const generation = epoch.current;
    const active = () =>
      alive.current &&
      epoch.current === generation &&
      current.current.scope === scope &&
      current.current.supported;
    locked.current = true;
    attempt.current = command;
    setBusy(true);
    setFailed(false);
    setReviewing(null);
    try {
      const payloadHash = prior?.hash ?? (await hash(staffCommandPayload(command)));
      if (!active()) return;
      const confirmed = prior && staffCommandConfirmed(command, prior.hash, current.current.status);
      if (!confirmed && !staffCommandCurrent(command, current.current.status)) {
        setPending({ command, hash: payloadHash });
        return;
      }
      setPending({ command, hash: payloadHash });
      await send(command);
    } catch {
      if (active()) setFailed(true);
    } finally {
      locked.current = false;
      if (active()) setBusy(false);
    }
  }
  function act(kind: StaffCommand['kind'], enabled = true) {
    if (current.current.scope !== scope || !alive.current) return;
    const command = captureStaffCommand(kind, status, actorId, companyId, locale, id, enabled);
    if (command) void perform(command);
  }
  function retry() {
    if (original && retryable) void perform(original, pending ?? undefined);
  }
  function review() {
    if (locked.current || !alive.current || current.current.scope !== scope) return;
    setReviewing(original?.kind ?? (status?.ready ? 'sync' : 'configure'));
    attempt.current = null;
    setPending(null);
    setFailed(false);
  }
  return {
    status: valid ? status : null,
    phase,
    busy,
    pending,
    reviewing,
    retryable,
    act,
    retry,
    review,
    cancelReview: () => setReviewing(null),
  };
}
