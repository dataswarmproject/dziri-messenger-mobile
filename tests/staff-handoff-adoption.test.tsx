import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { useStaffSession } from '../src/inbox/use-staff-session';
import { useStaffHandoff } from '../src/inbox/use-staff-handoff';
import { loadPendingHandoff, savePendingHandoff } from '../src/inbox/handoff-store';
import {
  staffHandoffMessage,
  staffWorkspaceKey,
  type StaffWorkspace,
} from '../src/dziri/messenger-staff.generated';
const h = vi.hoisted(() => ({
  values: new Map<string, string>(),
  action: vi.fn(),
  fetch: vi.fn(),
}));
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
  digestStringAsync: async (_algorithm: string, value: string) =>
    createHash('sha256').update(value).digest('hex'),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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
  role: 'agent',
  email: 'agent@synthetic.invalid',
  authorityKey: 'v1:' + 'a'.repeat(64),
};
const ticket = { cipher: 'synthetic-cipher', iv: 'abcdefghijklmnop', keyVersion: 1 };
const pending = () => ({
  version: 1 as const,
  scope: staffWorkspaceKey(w),
  ticket,
  expiresAt: Date.now() + 300_000,
});
const ready = () => ({
  state: 'ready',
  auth: { accessToken: 'synthetic-token', client: 'device', uid: w.email },
  user_id: 80,
  account_id: 43,
  inbox_id: 2,
  authority_key: w.authorityKey,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
});
const profile = {
  id: 80,
  email: w.email,
  name: 'Synthetic agent',
  pubsub_token: 'synthetic-pubsub',
  accounts: [{ id: 43, name: 'Business', role: 'agent', status: 'active' }],
};
const response = (data = profile) =>
  new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const convex = { action: h.action };
let root: Root,
  host: HTMLDivElement,
  session: ReturnType<typeof useStaffSession>,
  flow: ReturnType<typeof useStaffHandoff>;
function Handoff({
  reserve,
  scope,
}: {
  reserve: ReturnType<typeof useStaffSession>['reserveHandoff'];
  scope: StaffWorkspace;
}) {
  flow = useStaffHandoff(scope, convex, reserve);
  return <p>{flow.state}</p>;
}
function Harness({ scope }: { scope: StaffWorkspace }) {
  session = useStaffSession(scope, false, 'en');
  return session.profile ? (
    <p>Verified staff</p>
  ) : (
    <Handoff key={staffWorkspaceKey(scope)} scope={scope} reserve={session.reserveHandoff} />
  );
}
const show = (scope = w) =>
  act(async () => {
    root.render(<Harness scope={scope} />);
  });
beforeEach(() => {
  h.values.clear();
  h.action.mockReset();
  h.fetch.mockReset();
  h.action.mockImplementation(async (ref, args) =>
    getFunctionName(ref).endsWith(':prepare')
      ? { state: 'prepared', ticket, expiresAt: Date.now() + 300_000 }
      : args.phase === 'cancel'
        ? { state: 'cancelled' }
        : ready(),
  );
  h.fetch.mockResolvedValue(response());
  vi.stubGlobal('fetch', h.fetch);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

test('explicit handoff issues once and only publishes after the actual provider profile boundary', async () => {
  await show();
  expect(h.action).not.toHaveBeenCalled();
  expect(h.fetch).not.toHaveBeenCalled();
  await act(async () => {
    await flow.start();
  });
  expect(session.profile?.id).toBe(80);
  expect(h.action).toHaveBeenCalledTimes(2);
  expect(h.fetch.mock.calls.map(c => c[0])).toEqual([w.origin + '/api/v1/profile']);
  expect(await loadPendingHandoff(w)).not.toBeNull();
  expect(host.textContent).toBe('Verified staff');
});
test('MFA and recovery factors stay in memory and password fallback is reserved', async () => {
  h.action.mockImplementation(async (ref, args) =>
    getFunctionName(ref).endsWith(':prepare')
      ? { state: 'prepared', ticket, expiresAt: Date.now() + 300_000 }
      : args.phase === 'begin'
        ? {
            state: 'mfa_required',
            challenge: 'c'.repeat(64),
            expires_at: Math.floor(Date.now() / 1000) + 300,
          }
        : ready(),
  );
  await show();
  await act(async () => {
    await flow.start();
  });
  expect(flow.state).toBe('mfa_required');
  expect(flow.blocked).toBe(true);
  await act(async () => {
    await session.login(w.email, 'synthetic-password');
  });
  expect(h.fetch).not.toHaveBeenCalled();
  await act(async () => {
    await flow.verify({ backupCode: 'AB12CD34' });
  });
  expect(session.profile?.id).toBe(80);
  expect([...h.values.values()].join('')).not.toMatch(/AB12CD34|cccccccccccccccc/);
});
test('restarting the screen discovers the saved attempt without issuing and resumes the same ticket', async () => {
  await savePendingHandoff(w, pending());
  await show();
  expect(flow.state).toBe('review_required');
  expect(h.action).not.toHaveBeenCalled();
  await act(async () => {
    await flow.resume();
  });
  expect(h.action).toHaveBeenCalledTimes(1);
  expect(h.action.mock.calls[0][1]).toEqual({ phase: 'begin', ticket });
  expect(session.profile?.id).toBe(80);
});
test('a provider failure retries the original ticket and never prepares a replacement', async () => {
  let failed = false;
  h.action.mockImplementation(async (ref, args) => {
    if (getFunctionName(ref).endsWith(':prepare'))
      return { state: 'prepared', ticket, expiresAt: Date.now() + 300_000 };
    if (!failed) {
      failed = true;
      throw new Error('private provider details');
    }
    return ready();
  });
  await show();
  await act(async () => {
    await flow.start();
  });
  expect(flow.state).toBe('transport_failed');
  expect(flow.pending).toBe(true);
  await act(async () => {
    await flow.resume();
  });
  expect(h.action.mock.calls.filter(c => getFunctionName(c[0]).endsWith(':prepare'))).toHaveLength(
    1,
  );
  expect(session.profile?.id).toBe(80);
});
test('unconfirmed cancellation retains proof and blocks a fresh password login in the screen', async () => {
  await savePendingHandoff(w, pending());
  h.action.mockResolvedValue({ state: 'revocation_unconfirmed' });
  await show();
  await act(async () => {
    await flow.cancel();
  });
  expect(flow.state).toBe('revocation_unconfirmed');
  expect(flow.blocked).toBe(true);
  expect(await loadPendingHandoff(w)).not.toBeNull();
  expect(h.fetch).not.toHaveBeenCalled();
  h.action.mockResolvedValue({ state: 'cancelled' });
  await act(async () => {
    await flow.cancel();
  });
  expect(flow.blocked).toBe(false);
  expect(await loadPendingHandoff(w)).toBeNull();
});
test('a mismatched provider profile cancels the issued attempt without saving auth', async () => {
  h.fetch.mockResolvedValue(response({ ...profile, id: 81 }));
  await show();
  await act(async () => {
    await flow.start();
  });
  expect(session.profile).toBeNull();
  expect(flow.state).toBe('cancelled');
  expect([...h.values.values()].join('')).not.toContain('synthetic-token');
  expect(h.action.mock.calls.at(-1)?.[1]).toEqual({ phase: 'cancel', ticket });
});
test('workspace replacement during profile validation prevents late credential adoption', async () => {
  let resolve!: (r: Response) => void;
  h.fetch.mockImplementation(
    () =>
      new Promise<Response>(r => {
        resolve = r;
      }),
  );
  await show();
  let work!: Promise<void>;
  await act(async () => {
    work = flow.start();
  });
  await show({ ...w, authorityKey: 'v1:' + 'b'.repeat(64) });
  await act(async () => {
    resolve(response());
    await work;
  });
  expect(session.profile).toBeNull();
  expect([...h.values.values()].join('')).not.toContain('synthetic-token');
});
test('server-disabled preparation releases the reservation and sends no provider request', async () => {
  h.action.mockResolvedValue({ state: 'disabled' });
  await show();
  await act(async () => {
    await flow.start();
  });
  expect(flow.blocked).toBe(false);
  expect(session.busy).toBe(false);
  expect(h.fetch).not.toHaveBeenCalled();
  expect(h.action).toHaveBeenCalledOnce();
});

test('cancel during provider profile validation removes local auth and late adoption stays closed', async () => {
  let resolve!: (r: Response) => void;
  h.fetch.mockImplementation(
    () =>
      new Promise<Response>(r => {
        resolve = r;
      }),
  );
  await show();
  let work!: Promise<void>;
  await act(async () => {
    work = flow.start();
  });
  await act(async () => {
    await flow.cancel();
  });
  expect(flow.state).toBe('cancelled');
  await act(async () => {
    resolve(response());
    await work;
  });
  expect(session.profile).toBeNull();
  expect(flow.state).toBe('cancelled');
  expect([...h.values.values()].join('')).not.toContain('synthetic-token');
});

test('double activation cannot issue two handoffs or release the active reservation', async () => {
  await show();
  await act(async () => {
    await Promise.all([flow.start(), flow.start()]);
  });
  expect(h.action).toHaveBeenCalledTimes(2);
  expect(session.profile?.id).toBe(80);
});
test('handoff copy handles every server state safely in all supported languages', () => {
  for (const locale of ['en', 'fr', 'ar']) {
    for (const state of [
      'idle',
      'mfa_required',
      'challenge_failed',
      'invalid_attempt',
      'revocation_unconfirmed',
      'storage_failed',
      'review_required',
      'authority_changed',
      'reauthenticate',
      'security_setup_required',
      'federated_auth_required',
      'disabled',
      'unavailable',
      'cancelled',
      'transport_failed',
    ])
      expect(staffHandoffMessage(state, locale).length).toBeGreaterThan(10);
  }
});
