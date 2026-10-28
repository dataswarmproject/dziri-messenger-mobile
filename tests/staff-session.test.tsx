import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { useStaffSession } from '../src/inbox/use-staff-session';
import type { StaffWorkspace } from '../src/dziri/messenger-staff.generated';
import { staffWorkspaceKey, staffCopy } from '../src/dziri/messenger-staff.generated';
import { inboxSessionScope } from '../src/inbox/session-key';
import { secureStorageKey } from '../src/dziri/config';
const h = vi.hoisted(() => ({
  store: new Map<string, string>(),
  writes: [] as string[],
  gets: vi.fn(),
  fetch: vi.fn(),
  locale: 'en',
  saveFails: false,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: (key: string) => h.gets(key),
  setItemAsync: async (key: string, value: string) => {
    if (h.saveFails) throw new Error('synthetic storage detail');
    h.writes.push(value);
    h.store.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    h.store.delete(key);
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const first: StaffWorkspace = {
  version: 1,
  observationId: 'synthetic-observation-1',
  actorId: 'alice',
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
const session = { 'access-token': 'synthetic-token', client: 'device', uid: first.email };
const profile = {
  id: 80,
  email: first.email,
  name: 'Synthetic agent',
  pubsub_token: 'synthetic-pubsub',
  accounts: [{ id: 43, name: 'Business', role: 'agent', status: 'active' }],
};
const response = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json', ...session },
  });
let root: Root, host: HTMLDivElement, flow: ReturnType<typeof useStaffSession>;
function Harness({ scope }: { scope: StaffWorkspace }) {
  flow = useStaffSession(scope, false, h.locale);
  return (
    <p>
      {flow.profile?.email ?? 'signed out'}
      {flow.error}
    </p>
  );
}
const show = (scope = first) => act(async () => root.render(<Harness scope={scope} />));
beforeEach(() => {
  h.store.clear();
  h.locale = 'en';
  h.saveFails = false;
  h.writes = [];
  h.gets.mockClear();
  h.gets.mockImplementation(async (key: string) => h.store.get(key) ?? null);
  h.fetch.mockReset();
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
test('login persists only after a fresh matching profile and keeps another account out', async () => {
  h.fetch.mockImplementation(async (url: string) =>
    url.endsWith('/auth/sign_in') ? response({ data: profile }) : response(profile),
  );
  await show();
  await act(async () => {
    await flow.login(first.email, 'synthetic-password');
  });
  expect(flow.profile?.id).toBe(80);
  expect(h.writes).toHaveLength(1);
  expect(h.fetch.mock.calls.map(c => c[0])).toEqual([
    first.origin + '/auth/sign_in',
    first.origin + '/api/v1/profile',
  ]);
});
test('an old login completion cannot persist or show a session after scope replacement', async () => {
  let finish!: (value: Response) => void;
  h.fetch.mockImplementation(
    () =>
      new Promise<Response>(resolve => {
        finish = resolve;
      }),
  );
  await show();
  let pending!: Promise<string | undefined>;
  await act(async () => {
    pending = flow.login(first.email, 'synthetic-password');
  });
  await show({ ...first, authorityKey: 'v1:' + 'b'.repeat(64) });
  await act(async () => {
    finish(response({ data: profile }));
    await pending;
  });
  expect(flow.profile).toBeNull();
  expect(h.writes).toEqual([]);
});
test('unmounted login responses create no saved session', async () => {
  let finish!: (value: Response) => void;
  h.fetch.mockImplementation(
    () =>
      new Promise<Response>(resolve => {
        finish = resolve;
      }),
  );
  await show();
  let pending!: Promise<string | undefined>;
  await act(async () => {
    pending = flow.login(first.email, 'synthetic-password');
  });
  await act(async () => root.render(<span />));
  await act(async () => {
    finish(response({ data: profile }));
    await pending;
  });
  expect(h.writes).toEqual([]);
});
test('local logout clears the vault before a pending remote revocation completes', async () => {
  let revoked!: (value: Response) => void;
  h.fetch.mockImplementation(async (url: string) =>
    url.endsWith('/auth/sign_in') ? response({ data: profile }) : response(profile),
  );
  await show();
  await act(async () => {
    await flow.login(first.email, 'synthetic-password');
  });
  expect(h.store.size).toBe(1);
  h.fetch.mockImplementation(
    () =>
      new Promise<Response>(resolve => {
        revoked = resolve;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = flow.logout();
  });
  expect(h.store.size).toBe(0);
  expect(flow.profile).toBeNull();
  await act(async () => {
    revoked(response({}));
    await pending;
  });
  expect(h.store.size).toBe(0);
});
test('a stale vault load cannot authenticate a replacement workspace', async () => {
  let finish!: (value: string) => void;
  h.gets.mockImplementationOnce(
    () =>
      new Promise<string>(resolve => {
        finish = resolve;
      }),
  );
  await show();
  await show({ ...first, authorityKey: 'v1:' + 'b'.repeat(64) });
  await act(async () => {
    finish(JSON.stringify(session));
  });
  expect(h.fetch).not.toHaveBeenCalled();
  expect(flow.profile).toBeNull();
  expect(h.writes).toEqual([]);
});
test('a foreign saved uid is removed without a provider request', async () => {
  const key = secureStorageKey(inboxSessionScope(first.origin, staffWorkspaceKey(first)));
  h.store.set(key, JSON.stringify({ ...session, uid: 'foreign@synthetic.invalid' }));
  await show();
  expect(h.fetch).not.toHaveBeenCalled();
  expect(h.store.size).toBe(0);
  expect(flow.profile).toBeNull();
});
test('remote sign-out failure leaves local credentials removed with an honest warning', async () => {
  h.fetch.mockImplementation(async (url: string) =>
    url.endsWith('/auth/sign_in') ? response({ data: profile }) : response(profile),
  );
  await show();
  await act(async () => {
    await flow.login(first.email, 'synthetic-password');
  });
  h.fetch.mockRejectedValue(new Error('synthetic-private-provider-detail'));
  await act(async () => {
    await flow.logout();
  });
  expect(h.store.size).toBe(0);
  expect(flow.error).toBe(staffCopy('en').workspaceLogout);
  expect(host.textContent).not.toContain('synthetic-private-provider-detail');
  const requests = h.fetch.mock.calls.length;
  h.locale = 'ar';
  await show();
  expect(flow.error).toBe(staffCopy('ar').workspaceLogout);
  expect(h.fetch.mock.calls).toHaveLength(requests);
});
test('vault failure keeps the verified session in memory and exposes a localized warning', async () => {
  h.saveFails = true;
  h.fetch.mockImplementation(async (url: string) =>
    url.endsWith('/auth/sign_in') ? response({ data: profile }) : response(profile),
  );
  await show();
  await act(async () => {
    await flow.login(first.email, 'synthetic-password');
  });
  expect(flow.profile?.id).toBe(80);
  expect(flow.error).toBe(staffCopy('en').workspaceStorage);
  expect(h.store.size).toBe(0);
});
