import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { webcrypto, createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { StaffSetup, StaffSetupScreen } from '../src/dziri/staff-setup';
import { staffCopy } from '../src/dziri/messenger-staff.generated';
const h = vi.hoisted(() => ({
  actor: 'alice',
  locale: 'en',
  supported: true,
  businesses: [{ id: 'company', name: 'Synthetic business', role: 'owner' }],
  status: undefined as any,
  queries: [] as any[],
  configure: vi.fn(),
  sync: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useQuery: (ref: any, args: any) => {
    const name = getFunctionName(ref);
    h.queries.push({ name, args });
    if (name === 'users:getMe') return { _id: h.actor };
    if (name.endsWith(':capabilities'))
      return { features: { staffSetup: h.supported ? 1 : 0 }, businesses: h.businesses };
    return args === 'skip' ? undefined : h.status;
  },
  useMutation: (ref: any) => (getFunctionName(ref).endsWith(':configure') ? h.configure : h.sync),
}));
vi.mock('expo-crypto', () => ({
  randomUUID: () => webcrypto.randomUUID(),
  digestStringAsync: async (_: unknown, payload: string) =>
    createHash('sha256').update(payload).digest('hex'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({ locale: h.locale, rtl: h.locale === 'ar' }),
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children, accessibilityRole }: any) => (
    <span role={accessibilityRole === 'alert' ? 'alert' : undefined}>{children}</span>
  ),
}));
vi.mock('../src/dziri/figma', () => ({ FigmaButton: () => <span /> }));
vi.mock('../src/dziri/ui', () => ({
  Notice: ({ text }: any) => <p role="status">{text}</p>,
  useColors: () => ({
    text: '#111',
    secondary: '#666',
    background: '#fff',
    surface: '#eee',
    border: '#ddd',
    primary: '#111',
    onPrimary: '#fff',
  }),
}));
vi.mock('react-native', () => ({
  View: ({ children, accessibilityRole }: any) => <div role={accessibilityRole}>{children}</div>,
  ScrollView: ({ children }: any) => <div>{children}</div>,
  Modal: ({ children, visible }: any) =>
    visible ? <div role="alertdialog">{children}</div> : null,
  Pressable: ({
    children,
    disabled,
    onPress,
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    testID,
  }: any) => (
    <button
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
      aria-label={accessibilityLabel}
      role={accessibilityRole}
      aria-checked={accessibilityState?.checked}>
      {children}
    </button>
  ),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
const context = (key = 'a') => ({ expectedActorId: h.actor, authorityKey: 'v1:' + key.repeat(64) });
const state = () => ({
  actorId: h.actor,
  companyId: 'company',
  canConfigure: true,
  available: true,
  configured: false,
  enabled: false,
  ready: false,
  staffReady: false,
  state: 'unconfigured',
  setupCommandState: null,
  staffCommandState: null,
  commandContext: context(),
});
const show = () =>
  act(async () =>
    root.render(
      <StaffSetup
        actorId={h.actor}
        businesses={h.businesses}
        supported={h.supported}
        locale={h.locale}
      />,
    ),
  );
const button = (label: string) =>
  [...host.querySelectorAll('button')].find(b => b.textContent?.trim() === label)!;
const click = (label: string) => act(async () => button(label).click());
beforeEach(() => {
  h.actor = 'alice';
  h.locale = 'en';
  h.supported = true;
  h.businesses = [{ id: 'company', name: 'Synthetic business', role: 'owner' }];
  h.status = state();
  h.queries = [];
  h.configure.mockReset().mockResolvedValue({ tenantId: 'tenant', jobId: 'job' });
  h.sync.mockReset().mockResolvedValue({ tenantId: 'tenant', jobId: 'job' });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
test('the actual native route wires the current signed-in account and capability', async () => {
  await act(async () =>
    root.render(<StaffSetupScreen {...({ navigation: { goBack: vi.fn() } } as never)} />),
  );
  expect(host.textContent).toContain(staffCopy('en').title);
  expect(h.queries.find(q => q.name === 'inbox/administration:status').args).toMatchObject({
    companyId: 'company',
    expectedActorId: 'alice',
  });
});
test('a native stop confirmation cannot borrow a replacement owner context', async () => {
  h.status = { ...state(), configured: true, enabled: true, ready: true };
  await show();
  await click(staffCopy('en').stop);
  h.status = { ...h.status, commandContext: context('d') };
  await show();
  const confirm = host.querySelector('[data-testid="confirm-staff-stop"]') as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  await act(async () => confirm.click());
  expect(h.configure).not.toHaveBeenCalled();
});
test('an older backend gets no administrative subscription', async () => {
  h.supported = false;
  await show();
  expect(h.queries.filter(q => q.args !== 'skip')).toEqual([]);
});
test('native setup is explicit and retains its original payload when retrying in Arabic', async () => {
  h.configure.mockRejectedValue(new Error('synthetic'));
  await show();
  expect(h.configure).not.toHaveBeenCalled();
  await click(staffCopy('en').setup);
  const original = h.configure.mock.calls[0][0];
  h.locale = 'ar';
  await show();
  await click(staffCopy('ar').retry);
  expect(h.configure.mock.calls[1][0]).toEqual(original);
});
test('native staff linking sends the current employee context without owner controls', async () => {
  h.businesses[0].role = 'editor';
  h.status = {
    ...state(),
    canConfigure: false,
    configured: true,
    enabled: true,
    ready: true,
    commandContext: undefined,
    staffContext: context('c'),
  };
  await show();
  expect(button(staffCopy('en').stop)).toBeUndefined();
  await click(staffCopy('en').link);
  expect(h.sync.mock.calls[0][0].commandContext).toEqual(context('c'));
});
test('native disable requires a confirmed choice', async () => {
  h.status = { ...state(), configured: true, enabled: true, ready: true };
  await show();
  await click(staffCopy('en').stop);
  await click(staffCopy('en').cancel);
  expect(h.configure).not.toHaveBeenCalled();
  await click(staffCopy('en').stop);
  await act(async () =>
    (host.querySelector('[data-testid="confirm-staff-stop"]') as HTMLButtonElement).click(),
  );
  expect(h.configure.mock.calls[0][0].enabled).toBe(false);
});
test('account switching retires the previous native setup callbacks', async () => {
  await show();
  const old = button(staffCopy('en').setup);
  h.actor = 'bob';
  h.status = state();
  await show();
  await act(async () => old.click());
  expect(h.configure).not.toHaveBeenCalled();
});
test('native accepted-request proof waits after a lost reply without resending', async () => {
  h.configure.mockRejectedValue(new Error('reply lost'));
  await show();
  await click(staffCopy('en').setup);
  const query = h.queries.filter(q => q.args?.pendingCommand).at(-1).args;
  h.status = {
    ...state(),
    configured: true,
    enabled: true,
    state: 'pending',
    commandContext: context('b'),
    confirmation: {
      ...query.pendingCommand,
      actorId: h.actor,
      companyId: 'company',
      tenantId: 'tenant',
      jobId: 'job',
      status: 'pending',
      retryable: false,
    },
  };
  await show();
  expect(host.textContent).toContain(staffCopy('en').waiting);
  expect(h.configure).toHaveBeenCalledTimes(1);
  expect(button(staffCopy('en').retry)).toBeUndefined();
});
test('native multi-business selection binds the intended company', async () => {
  h.businesses.push({ id: 'second', name: 'Second business', role: 'editor' });
  await show();
  expect(h.queries).toEqual([]);
  h.status = {
    ...state(),
    companyId: 'second',
    canConfigure: false,
    enabled: true,
    ready: true,
    commandContext: undefined,
    staffContext: context('c'),
  };
  await click('Second business');
  await click(staffCopy('en').link);
  expect(h.sync.mock.calls[0][0].companyId).toBe('second');
});
test('native revoked membership hides all old controls and callbacks', async () => {
  await show();
  const old = button(staffCopy('en').setup);
  h.businesses = [];
  await show();
  await act(async () => old.click());
  expect(h.configure).not.toHaveBeenCalled();
  expect(host.textContent).toContain(staffCopy('en').unavailable);
});
