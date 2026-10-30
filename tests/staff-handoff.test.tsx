import { expect, test, vi } from 'vitest';
import { StaffHandoff, type PendingHandoff } from '../src/inbox/handoff';
import type { StaffWorkspace } from '../src/dziri/messenger-staff.generated';
const workspace: StaffWorkspace = {
  version: 1,
  observationId: 'synthetic-observation',
  actorId: 'agent',
  companyId: 'company',
  tenantId: 'tenant',
  origin: 'https://synthetic-inbox.invalid',
  remoteUserId: 80,
  accountId: 43,
  inboxId: 2,
  role: 'agent',
  email: 'agent@synthetic.invalid',
  authorityKey: 'v1:' + 'a'.repeat(64),
};
const ticket = { cipher: 'synthetic-opaque-cipher', iv: 'abcdefghijklmnop', keyVersion: 1 };
function fixture() {
  let saved: PendingHandoff | null = null;
  const save = vi.fn(async (value: PendingHandoff | null) => {
    saved = value;
  });
  const prepare = vi.fn(async () => ({
    state: 'prepared',
    ticket,
    expiresAt: Date.now() + 300_000,
  }));
  const ready = {
    state: 'ready',
    auth: {
      accessToken: 'synthetic-provider-token',
      client: 'synthetic-client',
      uid: workspace.email,
    },
    user_id: 80,
    account_id: 43,
    inbox_id: 2,
    authority_key: workspace.authorityKey,
    expires_at: Math.floor(Date.now() / 1000) + 86_400,
  };
  const exchange = vi.fn(async (args: { phase: string }) =>
    args.phase === 'cancel' ? { state: 'cancelled' } : ready,
  );
  const accept = vi.fn(async () => {});
  const flow = new StaffHandoff(workspace, {
    prepare,
    exchange,
    load: async () => saved,
    save,
    accept,
  });
  return { flow, prepare, exchange, save, accept, ready, saved: () => saved };
}
test('issuance waits for durable pending-ticket persistence', async () => {
  const f = fixture();
  let release!: () => void;
  f.save.mockImplementationOnce(
    () =>
      new Promise<void>(r => {
        release = r;
      }),
  );
  const start = f.flow.start();
  await vi.waitFor(() => expect(f.save).toHaveBeenCalledOnce());
  expect(f.exchange).not.toHaveBeenCalled();
  release();
  expect(await start).toEqual({ state: 'ready' });
  expect(f.accept).toHaveBeenCalledOnce();
  expect(JSON.stringify(f.saved())).not.toContain('synthetic-provider-token');
});
test('storage failure prevents issuance', async () => {
  const f = fixture();
  f.save.mockRejectedValueOnce(new Error('private vault diagnostic'));
  expect(await f.flow.start()).toEqual({ state: 'storage_failed' });
  expect(f.exchange).not.toHaveBeenCalled();
  expect(f.accept).not.toHaveBeenCalled();
});
test('network retry retains the original ticket without preparing another attempt', async () => {
  const f = fixture();
  f.exchange.mockRejectedValueOnce(new Error('private network detail'));
  expect(await f.flow.start()).toEqual({ state: 'transport_failed' });
  expect(await f.flow.resume()).toEqual({ state: 'ready' });
  expect(f.prepare).toHaveBeenCalledOnce();
  expect(f.exchange.mock.calls.map(([arg]) => (arg as { ticket?: unknown }).ticket)).toEqual([
    ticket,
    ticket,
  ]);
});
test('MFA factor is ephemeral and backup-code verification keeps the same attempt', async () => {
  const f = fixture();
  f.exchange.mockResolvedValueOnce({
    state: 'mfa_required',
    challenge: 'b'.repeat(64),
    expires_at: Math.floor(Date.now() / 1000) + 300,
  } as never);
  expect(await f.flow.start()).toMatchObject({ state: 'mfa_required' });
  expect(await f.flow.verify({ backupCode: 'ABCDEF12' })).toEqual({ state: 'ready' });
  expect(f.exchange.mock.calls[1][0]).toMatchObject({
    ticket,
    phase: 'verify',
    backupCode: 'ABCDEF12',
    challenge: 'b'.repeat(64),
  });
  expect(JSON.stringify(f.saved())).not.toContain('ABCDEF12');
});
test('uncertain cancellation retains cleanup proof, confirmed cancellation removes it', async () => {
  const f = fixture();
  await f.flow.start();
  f.exchange.mockResolvedValueOnce({ state: 'revocation_unconfirmed' } as never);
  expect(await f.flow.cancel()).toEqual({ state: 'revocation_unconfirmed' });
  expect(f.saved()).not.toBeNull();
  expect(await f.flow.cancel()).toEqual({ state: 'cancelled' });
  expect(f.saved()).toBeNull();
});
test('dispose during issuance cancels late credentials without accepting them', async () => {
  const f = fixture();
  let release!: (v: typeof f.ready) => void;
  f.exchange.mockImplementationOnce(
    () =>
      new Promise(r => {
        release = r;
      }),
  );
  const pending = f.flow.start();
  await vi.waitFor(() => expect(f.exchange).toHaveBeenCalledOnce());
  f.flow.dispose();
  release(f.ready);
  expect(await pending).toEqual({ state: 'cancelled' });
  expect(f.accept).not.toHaveBeenCalled();
  expect(f.exchange.mock.calls[1][0]).toMatchObject({ ticket, phase: 'cancel' });
});
test('foreign workspace credentials never reach the staff session client', async () => {
  const f = fixture();
  f.exchange.mockResolvedValueOnce({ ...f.ready, account_id: 44 });
  expect(await f.flow.start()).toEqual({ state: 'cancelled' });
  expect(f.accept).not.toHaveBeenCalled();
});
