import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import StaffWorkspaceEntry from '../src/inbox/workspace-entry';
import { staffCopy } from '../src/dziri/messenger-staff.generated';
const h = vi.hoisted(() => ({
  queries: [] as any[],
  mounts: [] as string[],
  closed: [] as string[],
  value: null as any,
  locale: 'en',
  connected: true,
  staleObservation: null as string | null,
  sequence: 0,
}));
vi.mock('convex/react', () => ({
  useConvexConnectionState: () => ({ isWebSocketConnected: h.connected }),
  useQuery: (_: unknown, args: unknown) => {
    h.queries.push(args);
    return h.value
      ? { ...h.value, observationId: h.staleObservation ?? (args as any).observationId }
      : h.value;
  },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => `synthetic-observation-${++h.sequence}` }));
vi.mock('../src/dziri/locale', () => ({ useLocale: () => ({ locale: h.locale }) }));
vi.mock('../src/dziri/theme', () => ({
  colorsFor: () => ({ text: '#fff', background: '#000', border: '#777' }),
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children, accessibilityRole }: any) => (
    <span role={accessibilityRole === 'alert' ? 'alert' : undefined}>{children}</span>
  ),
}));
vi.mock('react-native', () => ({
  View: ({ children }: any) => <div>{children}</div>,
  ScrollView: ({ children }: any) => <div>{children}</div>,
  Pressable: ({ children, onPress, 'aria-checked': checked }: any) => (
    <button aria-checked={checked} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock('../src/inbox/app', () => ({
  default: ({ workspace }: any) => {
    useEffect(() => {
      h.mounts.push(workspace.authorityKey);
      return () => {
        h.closed.push(workspace.authorityKey);
      };
    }, []);
    return <p>{workspace.email}</p>;
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const descriptor = () => ({
  version: 1,
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
});
let root: Root, host: HTMLDivElement;
let businesses = [{ id: 'company', name: 'Business', role: 'editor' }],
  supported = true,
  actorId = 'alice';
const show = () =>
  act(async () =>
    root.render(
      <StaffWorkspaceEntry actorId={actorId} businesses={businesses} supported={supported} />,
    ),
  );
beforeEach(() => {
  h.value = descriptor();
  h.queries = [];
  h.mounts = [];
  h.closed = [];
  h.locale = 'en';
  h.connected = true;
  h.staleObservation = null;
  h.sequence = 0;
  actorId = 'alice';
  supported = true;
  businesses = [{ id: 'company', name: 'Business', role: 'editor' }];
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
test('unsupported backends never receive a staff workspace subscription', async () => {
  supported = false;
  await show();
  expect(h.queries).toEqual([]);
  expect(h.mounts).toEqual([]);
});
test('a current acknowledged workspace enters the isolated runtime', async () => {
  await show();
  expect(h.queries.at(-1)).toMatchObject({ companyId: 'company', expectedActorId: 'alice' });
  expect(h.mounts).toEqual([descriptor().authorityKey]);
});
test('a cached descriptor for another actor cannot mount a staff runtime', async () => {
  h.value.actorId = 'other';
  await show();
  expect(h.mounts).toEqual([]);
});
test('multiple businesses require explicit choice and query only that destination', async () => {
  businesses.push({ id: 'second', name: 'Second business', role: 'owner' });
  h.value = { ...descriptor(), companyId: 'second' };
  await show();
  expect(h.queries).toEqual([]);
  await act(async () => {
    [...host.querySelectorAll('button')].find(b => b.textContent === 'Second business')!.click();
  });
  expect(h.queries.at(-1).companyId).toBe('second');
  expect(
    [...host.querySelectorAll('button')]
      .find(b => b.textContent === 'Second business')!
      .getAttribute('aria-checked'),
  ).toBe('true');
  expect(h.mounts).toHaveLength(1);
});
test('revocation immediately removes the old staff runtime', async () => {
  await show();
  h.value = null;
  await show();
  expect(h.closed).toEqual([descriptor().authorityKey]);
  expect(host.textContent).not.toContain(descriptor().email);
  expect(host.textContent).toContain(staffCopy('en').workspaceSetupRequired);
});
test('a replacement authority disposes the previous runtime', async () => {
  await show();
  h.value = { ...descriptor(), authorityKey: 'v1:' + 'b'.repeat(64) };
  await show();
  expect(h.closed).toEqual([descriptor().authorityKey]);
  expect(h.mounts).toHaveLength(2);
});
test('loss of the canonical connection removes the staff runtime despite cached metadata', async () => {
  await show();
  h.connected = false;
  await show();
  expect(h.closed).toEqual([descriptor().authorityKey]);
  expect(host.textContent).not.toContain(descriptor().email);
});
test('reconnect requires a fresh server observation instead of cached authority', async () => {
  await show();
  const previous = h.queries.at(-1).observationId;
  h.connected = false;
  await show();
  h.connected = true;
  h.staleObservation = previous;
  await show();
  expect(h.queries.at(-1).observationId).not.toBe(previous);
  expect(h.mounts).toHaveLength(1);
});
