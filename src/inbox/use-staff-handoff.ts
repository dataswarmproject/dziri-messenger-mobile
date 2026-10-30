import { useEffect, useRef, useState } from 'react';
import type { ConvexReactClient } from 'convex/react';
import { staffWorkspaceKey, type StaffWorkspace } from '../dziri/messenger-staff.generated';
import { createStaffHandoff } from './handoff-client';
import { loadPendingHandoff } from './handoff-store';
import type { StaffHandoff } from './handoff';
import type { StaffReservation } from './use-staff-session';

/** Explicit staff-only actions. Mounting never starts a provider session or sends a factor. */
export function useStaffHandoff(
  workspace: StaffWorkspace,
  convex: Pick<ConvexReactClient, 'action'>,
  reserve: () => StaffReservation | null,
) {
  const key = staffWorkspaceKey(workspace);
  const [view, setView] = useState({ state: 'idle', busy: true, pending: false });
  const reserveRef = useRef(reserve);
  reserveRef.current = reserve;
  const owner = useRef<{
    active: boolean;
    sequence: number;
    running: boolean;
    flow: StaffHandoff | null;
    reservation: StaffReservation | null;
  } | null>(null);
  useEffect(() => {
    const current = {
      active: true,
      sequence: 0,
      running: false,
      flow: null as StaffHandoff | null,
      reservation: null as StaffReservation | null,
    };
    owner.current = current;
    setView({ state: 'idle', busy: true, pending: false });
    void loadPendingHandoff(workspace)
      .then(pending => {
        if (current.active && current.sequence === 0)
          setView({ state: pending ? 'review_required' : 'idle', busy: false, pending: !!pending });
      })
      .catch(() => {
        if (current.active && current.sequence === 0)
          setView({ state: 'storage_failed', busy: false, pending: true });
      });
    return () => {
      current.active = false;
      current.flow?.dispose();
      void current.reservation?.release().catch(() => {});
    };
    // The immutable workspace owns the entire lifecycle; locale and render callbacks do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, convex]);

  async function run(
    kind: 'start' | 'resume' | 'verify',
    factor?: { otpCode: string } | { backupCode: string },
  ) {
    const current = owner.current;
    if (!current?.active || view.busy || current.running) return;
    if (!current.reservation) current.reservation = reserveRef.current();
    if (!current.reservation) return;
    if (!current.flow)
      current.flow = createStaffHandoff(workspace, convex, current.reservation.accept);
    current.running = true;
    const sequence = ++current.sequence;
    setView(v => ({ ...v, busy: true }));
    let state = 'storage_failed';
    try {
      const result =
        kind === 'verify' && factor
          ? await current.flow.verify(factor)
          : kind === 'start'
            ? await current.flow.start()
            : await current.flow.resume();
      state = result.state;
      if (!current.active || sequence !== current.sequence) return;
      if (state === 'ready') {
        current.reservation.complete();
        return;
      }
      const pending = await loadPendingHandoff(workspace);
      if (!current.active || sequence !== current.sequence) return;
      if (!pending) {
        await current.reservation.release();
        current.reservation = null;
        current.flow.dispose();
        current.flow = null;
      }
      setView({ state, busy: false, pending: !!pending });
    } catch {
      if (current.active && sequence === current.sequence)
        setView({ state: 'storage_failed', busy: false, pending: true });
    } finally {
      if (sequence === current.sequence) current.running = false;
    }
  }
  async function cancel() {
    const current = owner.current;
    if (!current?.active) return;
    const sequence = ++current.sequence;
    setView(v => ({ ...v, busy: true }));
    // Invalidate credential adoption immediately, before any remote cleanup wait.
    const release = current.reservation?.release().then(
      () => true,
      () => false,
    );
    const flow =
      current.flow ??
      createStaffHandoff(workspace, convex, async () => {
        throw new Error('Cancellation cannot adopt a staff session');
      });
    try {
      const result = await flow.cancel();
      if ((await release) === false) throw new Error('Staff credentials could not be cleared');
      if (!current.active || sequence !== current.sequence) return;
      const pending = await loadPendingHandoff(workspace);
      if (!current.active || sequence !== current.sequence) return;
      flow.dispose();
      current.flow = null;
      current.reservation = null;
      current.running = false;
      setView({ state: result.state, busy: false, pending: !!pending });
    } catch {
      if (current.active && sequence === current.sequence)
        setView({ state: 'storage_failed', busy: false, pending: true });
    }
  }
  return {
    ...view,
    blocked: view.busy || view.pending,
    start: () => run('start'),
    resume: () => run('resume'),
    verify: (factor: { otpCode: string } | { backupCode: string }) => run('verify', factor),
    cancel,
  };
}
