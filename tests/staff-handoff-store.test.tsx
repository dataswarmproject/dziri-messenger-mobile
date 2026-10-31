import { beforeEach, expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    createHash('sha256').update(value).digest('hex'),
}));
import { getFunctionName, type FunctionReference } from 'convex/server';
import type { ConvexReactClient } from 'convex/react';
import { createStaffHandoff } from '../src/inbox/handoff-client';
import {
  loadPendingHandoff,
  savePendingHandoff,
  listPendingHandoffs,
  clearRecoveredHandoff,
} from '../src/inbox/handoff-store';
import { staffWorkspaceKey, type StaffWorkspace } from '../src/dziri/messenger-staff.generated';
const h = vi.hoisted(() => ({
  values: new Map<string, string>(),
  writes: [] as string[],
  failAtWrite: 0,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => h.values.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (h.failAtWrite === h.writes.length + 1) throw new Error('Synthetic interrupted write');
    h.values.set(key, value);
    h.writes.push(value);
  },
  deleteItemAsync: async (key: string) => {
    h.values.delete(key);
  },
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
beforeEach(() => {
  h.values.clear();
  h.writes.length = 0;
  h.failAtWrite = 0;
});
test('native pending recovery stores only an encrypted ticket in the scoped OS vault', async () => {
  const p = pending();
  await savePendingHandoff(w, { ...p, auth: 'must-never-persist' } as typeof p);
  expect(await loadPendingHandoff(w)).toEqual(p);
  expect(h.writes[0]).not.toContain('must-never-persist');
  expect(await loadPendingHandoff({ ...w, actorId: 'another' })).toBeNull();
});
test('cleanup compares ticket identity independently of object key order', async () => {
  const p = pending();
  await savePendingHandoff(w, p);
  await savePendingHandoff(w, null, p);
  expect(await loadPendingHandoff(w)).toBeNull();
});
test('a stale removal cannot erase a replacement ticket', async () => {
  const p = pending(),
    next = { ...p, ticket: { ...p.ticket, cipher: 'replacement-cipher' } };
  await savePendingHandoff(w, p);
  await savePendingHandoff(w, null, p);
  await savePendingHandoff(w, next);
  await expect(savePendingHandoff(w, null, p)).rejects.toThrow('changed');
  expect(await loadPendingHandoff(w)).toEqual(next);
});
test('an unconfirmed attempt cannot be overwritten or blindly cleared', async () => {
  const p = pending();
  await savePendingHandoff(w, p);
  await expect(
    savePendingHandoff(w, { ...p, ticket: { ...p.ticket, cipher: 'replacement' } }),
  ).rejects.toThrow('changed');
  await expect(savePendingHandoff(w, null)).rejects.toThrow('changed');
  expect(await loadPendingHandoff(w)).toEqual(p);
});

test('the owner can discover an interrupted attempt after losing its workspace authority', async () => {
  const p = pending();
  await savePendingHandoff(w, p);
  expect(await loadPendingHandoff({ ...w, authorityKey: 'v1:' + 'b'.repeat(64) })).toBeNull();
  expect(await listPendingHandoffs(w.actorId)).toEqual([p]);
  expect(await listPendingHandoffs('another-account')).toEqual([]);
});

test('confirmed removal also retires the owner recovery-directory entry', async () => {
  const p = pending();
  await savePendingHandoff(w, p);
  await savePendingHandoff(w, null, p);
  expect(await listPendingHandoffs(w.actorId)).toEqual([]);
});

test('owner cleanup needs no current workspace descriptor after access is lost', async () => {
  const p = pending();
  await savePendingHandoff(w, p);
  await clearRecoveredHandoff(w.actorId, p);
  expect(await listPendingHandoffs(w.actorId)).toEqual([]);
  expect(await loadPendingHandoff(w)).toBeNull();
});

test('owner cleanup refuses a different account without removing proof', async () => {
  const p = pending();
  await savePendingHandoff(w, p);
  await expect(clearRecoveredHandoff('another-account', p)).rejects.toThrow();
  expect(await loadPendingHandoff(w)).toEqual(p);
});

test('recovered cleanup preserves a replacement attempt in the same workspace', async () => {
  const p = pending(),
    next = { ...p, ticket: { ...p.ticket, cipher: 'replacement' } };
  await savePendingHandoff(w, p);
  await clearRecoveredHandoff(w.actorId, p);
  await savePendingHandoff(w, next);
  await expect(clearRecoveredHandoff(w.actorId, p)).rejects.toThrow('changed');
  expect(await loadPendingHandoff(w)).toEqual(next);
  expect(await listPendingHandoffs(w.actorId)).toEqual([next]);
});

test('recovered cleanup can retire an attempt whose scoped copy was interrupted', async () => {
  const p = pending();
  h.failAtWrite = 3;
  await expect(savePendingHandoff(w, p)).rejects.toThrow();
  h.failAtWrite = 0;
  await clearRecoveredHandoff(w.actorId, p);
  expect(await listPendingHandoffs(w.actorId)).toEqual([]);
});

test('a cancelled marker survives index-write failure and permits exact cleanup retry', async () => {
  const p = pending();
  await savePendingHandoff(w, p);
  h.failAtWrite = 5;
  await expect(clearRecoveredHandoff(w.actorId, p)).rejects.toThrow();
  h.failAtWrite = 0;
  await clearRecoveredHandoff(w.actorId, p);
  expect(await listPendingHandoffs(w.actorId)).toEqual([]);
  await savePendingHandoff(w, { ...p, ticket: { ...p.ticket, cipher: 'new-attempt' } });
  expect((await loadPendingHandoff(w))?.ticket.cipher).toBe('new-attempt');
});

test('owner discovery rejects corrupted ticket fields before a cancellation request', async () => {
  const p = pending();
  await savePendingHandoff(w, p);
  const key = [...h.values.keys()].find(k => k.startsWith('staff-recovery.'))!;
  h.values.set(key, JSON.stringify({ ...p, ticket: { ...p.ticket, iv: 'corrupt' } }));
  await expect(listPendingHandoffs(w.actorId)).rejects.toThrow();
});

test('cold discovery retires confirmed markers so cancelled businesses cannot exhaust recovery capacity', async () => {
  for (let i = 0; i < 24; i++) {
    const workspace = { ...w, companyId: 'retired-company-' + i };
    const p = { ...pending(), scope: staffWorkspaceKey(workspace) };
    await savePendingHandoff(workspace, p);
    h.failAtWrite = h.writes.length + 2;
    await expect(clearRecoveredHandoff(w.actorId, p)).rejects.toThrow();
    h.failAtWrite = 0;
  }
  expect(await listPendingHandoffs(w.actorId)).toEqual([]);
  await savePendingHandoff(w, pending());
  expect(await listPendingHandoffs(w.actorId)).toHaveLength(1);
});

test('an interruption before the scope copy preserves owner discovery and resumable proof', async () => {
  const p = pending();
  h.failAtWrite = 3;
  await expect(savePendingHandoff(w, p)).rejects.toThrow('interrupted');
  h.failAtWrite = 0;
  expect(await listPendingHandoffs(w.actorId)).toEqual([p]);
  expect(await loadPendingHandoff(w)).toEqual(p);
});

test('real broker references and vault bind the captured workspace before provider-session acceptance', async () => {
  const input = { ...w },
    p = pending(),
    accept = vi.fn(async () => {});
  const action = vi.fn(async (ref: FunctionReference<'action'>, args: Record<string, unknown>) => {
    if (getFunctionName(ref) === 'inbox/staffHandoff:prepare') {
      expect(args).toEqual({ companyId: w.companyId, authorityKey: w.authorityKey });
      return { state: 'prepared', ticket: p.ticket, expiresAt: p.expiresAt };
    }
    expect(getFunctionName(ref)).toBe('inbox/staffHandoff:exchange');
    expect(await loadPendingHandoff(w)).toEqual(p);
    return {
      state: 'ready',
      auth: {
        accessToken: 'synthetic-provider-token',
        client: `dziri-staff:${'c'.repeat(48)}`,
        uid: w.email,
      },
      user_id: 80,
      account_id: 43,
      inbox_id: 2,
      authority_key: w.authorityKey,
      expires_at: Math.floor(Date.now() / 1000) + 86_400,
    };
  });
  const flow = createStaffHandoff(
    input,
    { action } as unknown as Pick<ConvexReactClient, 'action'>,
    accept,
  );
  input.companyId = 'replacement-business';
  expect(await flow.start()).toEqual({ state: 'ready' });
  expect(accept).toHaveBeenCalledWith({
    'access-token': 'synthetic-provider-token',
    client: `dziri-staff:${'c'.repeat(48)}`,
    uid: w.email,
  });
  expect(h.writes.every(value => !value.includes('synthetic-provider-token'))).toBe(true);
});
