import { beforeEach, expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { getFunctionName } from 'convex/server';
import { createOwnerRecovery } from '../src/inbox/owner-recovery';
import { savePendingHandoff, listPendingHandoffs } from '../src/inbox/handoff-store';
import { staffWorkspaceKey, type StaffWorkspace } from '../src/dziri/messenger-staff.generated';
const h = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => h.values.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    h.values.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    h.values.delete(key);
  },
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_: string, value: string) =>
    createHash('sha256').update(value).digest('hex'),
}));
const w: StaffWorkspace = {
  version: 1,
  observationId: 'synthetic-observation',
  actorId: 'agent',
  companyId: 'company',
  tenantId: 'tenant',
  origin: 'https://synthetic-inbox.invalid',
  remoteUserId: 80,
  accountId: 43,
  inboxId: 2,
  email: 'agent@synthetic.invalid',
  role: 'agent',
  authorityKey: 'v1:' + 'a'.repeat(64),
};
const pending = () => ({
  version: 1 as const,
  scope: staffWorkspaceKey(w),
  ticket: { cipher: 'synthetic-cipher', iv: 'abcdefghijklmnop', keyVersion: 1 },
  expiresAt: Date.now() + 300_000,
});
beforeEach(() => h.values.clear());
test('a former staff member can explicitly cancel the owned ticket without a workspace descriptor', async () => {
  const p = pending();
  await savePendingHandoff(w, p);
  const action = vi.fn(async (ref, args) => {
    expect(getFunctionName(ref)).toBe('inbox/staffHandoff:exchange');
    expect(args).toEqual({ phase: 'cancel', ticket: p.ticket });
    return { state: 'cancelled' };
  });
  const flow = createOwnerRecovery(w.actorId, { action });
  expect(await flow.load()).toEqual([p]);
  expect(action).not.toHaveBeenCalled();
  expect(await flow.cancel(p)).toEqual({ state: 'cancelled' });
  expect(await listPendingHandoffs(w.actorId)).toEqual([]);
});
test('foreign and changed ticket inputs never reach the broker', async () => {
  const p = pending();
  await savePendingHandoff(w, p);
  const action = vi.fn(async () => ({ state: 'cancelled' }));
  expect((await createOwnerRecovery('other-account', { action }).cancel(p)).state).toBe(
    'review_required',
  );
  expect(
    (
      await createOwnerRecovery(w.actorId, { action }).cancel({
        ...p,
        ticket: { ...p.ticket, cipher: 'foreign' },
      })
    ).state,
  ).toBe('review_required');
  expect(action).not.toHaveBeenCalled();
  expect(await listPendingHandoffs(w.actorId)).toEqual([p]);
});
test.each([
  'revocation_unconfirmed',
  'reauthenticate',
  'authority_changed',
  'disabled',
  'invalid_attempt',
])('retains proof when broker returns %s', async state => {
  const p = pending();
  await savePendingHandoff(w, p);
  const action = vi.fn(async () => ({ state }));
  expect((await createOwnerRecovery(w.actorId, { action }).cancel(p)).state).not.toBe('cancelled');
  expect(await listPendingHandoffs(w.actorId)).toEqual([p]);
});
test('network failure exposes no private diagnostics and never drops proof', async () => {
  const p = pending();
  await savePendingHandoff(w, p);
  const result = await createOwnerRecovery(w.actorId, {
    action: vi.fn(async () => {
      throw new Error('private synthetic detail');
    }),
  }).cancel(p);
  expect(result).toEqual({ state: 'revocation_unconfirmed' });
  expect(await listPendingHandoffs(w.actorId)).toEqual([p]);
});
test('a late confirmation cannot erase a replacement attempt in the same scope', async () => {
  const p = pending(),
    next = { ...p, ticket: { ...p.ticket, cipher: 'replacement' } };
  await savePendingHandoff(w, p);
  let finish!: (r: unknown) => void;
  const action = vi.fn(
    () =>
      new Promise(r => {
        finish = r;
      }),
  );
  const work = createOwnerRecovery(w.actorId, { action }).cancel(p);
  await vi.waitFor(() => expect(action).toHaveBeenCalledOnce());
  await savePendingHandoff(w, null, p);
  await savePendingHandoff(w, next);
  finish({ state: 'cancelled' });
  expect((await work).state).not.toBe('cancelled');
  expect(await listPendingHandoffs(w.actorId)).toEqual([next]);
});
