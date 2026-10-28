import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createHash, webcrypto } from 'node:crypto';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { SupportScreen, SupportConnection, SupportTargetProvider } from '../src/dziri/support';
import {
  supportCopy,
  supportStartPayload,
  captureSupportStart,
  validSupportPreparation,
  supportStartConfirmed,
} from '../src/dziri/messenger-support.generated';
const h = vi.hoisted(() => ({
  me: { _id: 'alice' } as any,
  caps: { features: { supportConsent: 1 } } as any,
  prepared: null as any,
  state: null as any,
  start: vi.fn(),
  stop: vi.fn(),
  queries: [] as any[],
  company: 'company',
  locale: 'en',
  id: 0,
}));
vi.mock('expo-crypto', () => ({
  randomUUID: () => 'synthetic-command-' + ++h.id,
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
vi.mock('../src/dziri/icons', () => ({ Icon: () => <span /> }));
vi.mock('../src/dziri/ui', () => ({
  Notice: ({ text }: any) => <p role="status">{text}</p>,
  useColors: () => ({
    background: '#fff',
    text: '#111',
    secondary: '#666',
    surface: '#eee',
    border: '#ddd',
    primary: '#111',
    onPrimary: '#fff',
  }),
}));
vi.mock('react-native', () => ({
  View: ({ children }: any) => <div>{children}</div>,
  Pressable: ({
    children,
    disabled,
    onPress,
    accessibilityRole,
    accessibilityLabel,
    accessibilityState,
  }: any) => (
    <button
      disabled={disabled}
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-checked={accessibilityState?.checked}
      onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock('convex/react', () => ({
  useQuery: (ref: any, args: any) => {
    const name = getFunctionName(ref);
    h.queries.push({ name, args });
    if (name === 'users:getMe') return h.me;
    if (name.includes('capabilities')) return h.caps;
    return args === 'skip'
      ? undefined
      : name.includes('supportAvailability')
        ? h.prepared
        : h.state;
  },
  useMutation: (ref: any) => (getFunctionName(ref).includes('startSupport') ? h.start : h.stop),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
const opened = vi.fn();
const context = (actor = 'alice', key = 'a') => ({
  expectedActorId: actor,
  authorityKey: 'v1:' + key.repeat(64),
});
async function show() {
  await act(async () =>
    root.render(
      <SupportTargetProvider value={h.company}>
        <SupportScreen
          navigation={{ replace: (_: string, args: any) => opened(args.threadId) } as any}
          route={{ key: 'support', name: 'Support' } as any}
        />
      </SupportTargetProvider>,
    ),
  );
}
async function showConnection() {
  await act(async () => root.render(<SupportConnection threadId="thread" />));
}
async function click(node: Element | null) {
  expect(node).not.toBeNull();
  await act(async () => {
    (node as HTMLElement).click();
  });
}
const button = (label: string) =>
  Array.from(host.querySelectorAll('button')).find(b => b.textContent === label) ?? null;
const consent = () => host.querySelector('[role="checkbox"],input[type="checkbox"]');
async function begin() {
  await show();
  await click(consent());
  await click(button(supportCopy(h.locale).start));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('crypto', webcrypto);
  h.queries = [];
  h.id = 0;
  h.me = { _id: 'alice' };
  h.company = 'company';
  h.locale = 'en';
  h.caps = { features: { supportConsent: 1 } };
  h.prepared = {
    companyId: 'company',
    name: 'Synthetic business',
    available: true,
    commandContext: context(),
  };
  h.state = {
    threadId: 'thread',
    connectionId: 'connection',
    generation: 1,
    connected: true,
    ready: false,
    phase: 'pending',
    orderId: null,
    commandContext: context(),
  };
  h.start.mockResolvedValue({ threadId: 'thread', connectionId: 'connection', generation: 1 });
  h.stop.mockResolvedValue(null);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
test('support starts only after explicit consent and submits the actual account and captured authority', async () => {
  await show();
  expect((button(supportCopy('en').start) as HTMLButtonElement).disabled).toBe(true);
  await click(consent());
  await click(button(supportCopy('en').start));
  expect(h.start).toHaveBeenCalledTimes(1);
  expect(h.start.mock.calls[0][0]).toMatchObject({
    companyId: 'company',
    consent: true,
    commandContext: context(),
  });
  expect(Object.isFrozen(h.start.mock.calls[0][0].commandContext)).toBe(true);
  expect(opened).toHaveBeenCalledWith('thread');
});
test('old backends never subscribe to missing support endpoints', async () => {
  h.caps = { features: {} };
  await show();
  expect(h.start).not.toHaveBeenCalled();
  expect(host.textContent).toContain(supportCopy('en').unavailable);
  expect(
    h.queries.filter(q => q.name.includes('inbox/service')).every(q => q.args === 'skip'),
  ).toBe(true);
});
test('a failed start retries the exact immutable command', async () => {
  h.start.mockRejectedValueOnce(new Error('Synthetic lost response'));
  await begin();
  const original = h.start.mock.calls[0][0];
  await click(button(supportCopy('en').retry));
  expect(h.start.mock.calls[1][0]).toBe(original);
  expect(opened).toHaveBeenCalledTimes(1);
});
test('a lost acknowledgement opens the exact confirmed result without another mutation', async () => {
  h.start.mockRejectedValueOnce(new Error('Synthetic lost response'));
  await begin();
  const command = h.start.mock.calls[0][0],
    payloadHash = 'v1:' + createHash('sha256').update(supportStartPayload(command)).digest('hex');
  h.prepared = {
    ...h.prepared,
    commandContext: context('alice', 'b'),
    confirmation: {
      clientCommandId: command.clientCommandId,
      payloadHash,
      threadId: 'confirmed',
      connectionId: 'connection',
      generation: 1,
    },
  };
  await show();
  await click(button(supportCopy('en').open));
  expect(opened).toHaveBeenCalledWith('confirmed');
  expect(h.start).toHaveBeenCalledTimes(1);
});
for (const change of ['account', 'destination', 'capability'] as const)
  test(`late support completion cannot navigate after ${change} changes`, async () => {
    let resolve!: (value: any) => void;
    h.start.mockImplementationOnce(() => new Promise(r => (resolve = r)));
    await begin();
    if (change === 'account') {
      h.me = { _id: 'bob' };
      h.prepared = { ...h.prepared, commandContext: context('bob') };
    } else if (change === 'destination') {
      h.company = 'other-company';
      h.prepared = { ...h.prepared, companyId: h.company };
    } else h.caps = { features: {} };
    await show();
    await act(async () =>
      resolve({ threadId: 'old-thread', connectionId: 'old-connection', generation: 1 }),
    );
    expect(opened).not.toHaveBeenCalled();
  });
test('changed authority requires a new explicit consent instead of replaying an old retry', async () => {
  h.start.mockRejectedValueOnce(new Error('Synthetic failed request'));
  await begin();
  h.prepared = { ...h.prepared, commandContext: context('alice', 'b') };
  await show();
  expect(button(supportCopy('en').retry)).toBeNull();
  await click(button(supportCopy('en').start));
  expect((button(supportCopy('en').start) as HTMLButtonElement).disabled).toBe(true);
  expect(h.start).toHaveBeenCalledTimes(1);
});
test('pending, ready and withdrawn state use the current connection and keep stop controls available', async () => {
  await showConnection();
  expect(host.textContent).toContain(supportCopy('en').pending);
  h.stop.mockRejectedValueOnce(new Error('Synthetic failure'));
  await click(button(supportCopy('en').stop));
  await click(button(supportCopy('en').stop));
  expect(h.stop.mock.calls[1][0]).toEqual(h.stop.mock.calls[0][0]);
  expect(h.stop.mock.calls[0][0]).toMatchObject({
    connectionId: 'connection',
    commandContext: context(),
  });
  h.state = { ...h.state, phase: 'ready', ready: true };
  await showConnection();
  expect(host.textContent).toContain(supportCopy('en').ready);
  h.state = { ...h.state, phase: 'stopped', connected: false, ready: false };
  await showConnection();
  expect(host.textContent).toContain(supportCopy('en').stopped);
  expect(button(supportCopy('en').stop)).toBeNull();
});
for (const locale of ['en', 'fr', 'ar'])
  test(`support uses the checked ${locale} copy`, async () => {
    h.locale = locale;
    await show();
    expect(host.textContent).toContain(supportCopy(locale).consent);
    await click(consent());
    expect((button(supportCopy(locale).start) as HTMLButtonElement).disabled).toBe(false);
  });
test('shared support preparation and proof reject another account or destination', () => {
  const c = captureSupportStart('company', context(), () => 'synthetic-command'),
    payloadHash = 'v1:' + 'c'.repeat(64);
  const prepared = {
    ...h.prepared,
    confirmation: {
      threadId: 'thread',
      connectionId: 'connection',
      generation: 1,
      clientCommandId: c.clientCommandId,
      payloadHash,
    },
  };
  expect(validSupportPreparation(prepared, 'alice', 'company')).toBe(true);
  expect(validSupportPreparation(prepared, 'bob', 'company')).toBe(false);
  expect(supportStartConfirmed(c, payloadHash, prepared)).toBe(true);
  expect(supportStartConfirmed(c, payloadHash, { ...prepared, companyId: 'other' })).toBe(false);
  expect(
    supportStartConfirmed(c, payloadHash, { ...prepared, commandContext: context('bob') }),
  ).toBe(false);
});
