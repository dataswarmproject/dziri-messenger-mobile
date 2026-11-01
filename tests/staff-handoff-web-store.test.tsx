import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { staffWorkspaceKey, type StaffWorkspace } from '../src/dziri/messenger-staff.generated';
const h = vi.hoisted(() => ({ nativeRead: vi.fn(), nativeWrite: vi.fn(), nativeRemove: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: h.nativeRead,
  setItemAsync: h.nativeWrite,
  deleteItemAsync: h.nativeRemove,
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_: string, value: string) =>
    createHash('sha256').update(value).digest('hex'),
}));
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
const pending = () => ({
  version: 1 as const,
  scope: staffWorkspaceKey(workspace),
  expiresAt: Date.now() + 300_000,
  ticket: { cipher: 'synthetic-cipher', iv: 'abcdefghijklmnop', keyVersion: 1 },
});
const store = () => import('../src/inbox/handoff-store');
beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem('synthetic.personal.session', 'preserved');
  localStorage.setItem('synthetic.personal.session', 'preserved');
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

test('web reload retains only encrypted owner-bound attempts in tab storage', async () => {
  const first = await store(),
    p = pending();
  await first.savePendingHandoff(workspace, {
    ...p,
    auth: 'must-never-persist',
    otpCode: '123456',
  } as typeof p);
  const keys = Object.keys(sessionStorage).filter(k => k !== 'synthetic.personal.session');
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.every(k => k.startsWith('dziri.staff.pending.v1.'))).toBe(true);
  expect(keys.map(k => sessionStorage.getItem(k)).join('')).not.toMatch(
    /must-never-persist|123456|otpCode|accessToken/,
  );
  vi.resetModules();
  const reloaded = await store();
  expect(await reloaded.loadPendingHandoff(workspace)).toEqual(p);
  expect(await reloaded.listPendingHandoffs(workspace.actorId)).toEqual([p]);
  expect(await reloaded.loadPendingHandoff({ ...workspace, actorId: 'other' })).toBeNull();
  expect(await reloaded.listPendingHandoffs('other')).toEqual([]);
  expect(h.nativeRead).not.toHaveBeenCalled();
  expect(h.nativeWrite).not.toHaveBeenCalled();
  expect(h.nativeRemove).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('synthetic.personal.session')).toBe('preserved');
  expect(localStorage.length).toBe(1);
});

test('owner recovery survives lost workspace authority and cancellation survives reload', async () => {
  const first = await store(),
    p = pending();
  await first.savePendingHandoff(workspace, p);
  vi.resetModules();
  const reloaded = await store();
  expect(
    await reloaded.loadPendingHandoff({ ...workspace, authorityKey: 'v1:' + 'b'.repeat(64) }),
  ).toBeNull();
  expect(await reloaded.listPendingHandoffs(workspace.actorId)).toEqual([p]);
  await reloaded.clearRecoveredHandoff(workspace.actorId, p);
  vi.resetModules();
  const final = await store();
  expect(await final.loadPendingHandoff(workspace)).toBeNull();
  expect(await final.listPendingHandoffs(workspace.actorId)).toEqual([]);
  expect(sessionStorage.getItem('synthetic.personal.session')).toBe('preserved');
});

test('stale cleanup after reload cannot erase a replacement ticket', async () => {
  const first = await store(),
    p = pending(),
    next = { ...p, ticket: { ...p.ticket, cipher: 'replacement' } };
  await first.savePendingHandoff(workspace, p);
  await first.savePendingHandoff(workspace, null, p);
  await first.savePendingHandoff(workspace, next);
  vi.resetModules();
  const reloaded = await store();
  await expect(reloaded.clearRecoveredHandoff(workspace.actorId, p)).rejects.toThrow('changed');
  expect(await reloaded.loadPendingHandoff(workspace)).toEqual(next);
});

test('denied tab storage blocks broker preparation instead of silently using memory', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw Error('Synthetic storage denial');
  });
  const { createStaffHandoff } = await import('../src/inbox/handoff-client'),
    action = vi.fn();
  const flow = createStaffHandoff(workspace, { action }, vi.fn());
  expect(await flow.start()).toMatchObject({ state: 'storage_failed' });
  expect(action).not.toHaveBeenCalled();
});

test('a quota failure before saving the encrypted ticket never exchanges for credentials', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('Synthetic storage quota');
  });
  const { createStaffHandoff } = await import('../src/inbox/handoff-client'),
    p = pending();
  const action = vi.fn(async () => ({
    state: 'prepared',
    ticket: p.ticket,
    expiresAt: p.expiresAt,
  }));
  const flow = createStaffHandoff(workspace, { action }, vi.fn());
  expect(await flow.start()).toMatchObject({ state: 'storage_failed' });
  expect(action).toHaveBeenCalledTimes(1);
  expect(getFunctionName(action.mock.calls[0][0])).toBe('inbox/staffHandoff:prepare');
});

test('corrupt saved attempt after reload blocks new issuance', async () => {
  const first = await store();
  await first.savePendingHandoff(workspace, pending());
  const key = Object.keys(sessionStorage).find(
    k =>
      k.startsWith('dziri.staff.pending.v1.dziri.') &&
      sessionStorage.getItem(k)?.includes('synthetic-cipher'),
  )!;
  sessionStorage.setItem(key, 'broken json');
  vi.resetModules();
  const { createStaffHandoff } = await import('../src/inbox/handoff-client'),
    action = vi.fn();
  expect(await createStaffHandoff(workspace, { action }, vi.fn()).start()).toMatchObject({
    state: 'storage_failed',
  });
  expect(action).not.toHaveBeenCalled();
});
