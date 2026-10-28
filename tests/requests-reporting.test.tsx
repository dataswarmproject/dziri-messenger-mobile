import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReportPanel, RequestBanner } from '../src/dziri/request-report';
const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  decide: vi.fn(),
  preview: {
    fingerprint: 'b'.repeat(64),
    body: 'Selected native fixture',
    type: 'text',
    attachmentCount: 0,
    alreadyReported: false,
  },
}));
vi.mock('convex/react', () => ({
  useQuery: () => mocks.preview,
  useMutation: (ref: any) =>
    String(ref[Symbol.for('functionName')]).includes('submit') ? mocks.submit : mocks.decide,
  usePaginatedQuery: () => ({ results: [], status: 'Exhausted' }),
}));
vi.mock('../src/dziri/screen-parts', () => ({ ScreenHeading: () => null }));
vi.mock('../src/dziri/locale', () => ({ useLocale: () => ({ locale: 'en', rtl: false }) }));
vi.mock('../src/dziri/ui', () => ({
  useColors: () => ({ text: '#111', secondary: '#666', surface: '#eee', background: '#fff' }),
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: any) => <span>{children}</span>,
  TextInput: ({ value, onChangeText, accessibilityLabel }: any) => (
    <textarea
      aria-label={accessibilityLabel}
      value={value}
      onChange={e => onChangeText(e.target.value)}
    />
  ),
}));
vi.mock('react-native', () => ({
  View: ({ children }: any) => <div>{children}</div>,
  ScrollView: ({ children }: any) => <div>{children}</div>,
  Pressable: ({ children, onPress, disabled, accessibilityRole, accessibilityState }: any) => (
    <button
      role={accessibilityRole}
      aria-checked={accessibilityState?.checked}
      disabled={disabled}
      onClick={onPress}>
      {children}
    </button>
  ),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.preview.alreadyReported = false;
  mocks.preview.fingerprint = 'b'.repeat(64);
  mocks.submit.mockResolvedValue({ reportId: 'native-report' });
  mocks.decide.mockResolvedValue(null);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
test('native Marketplace report requires consent and includes the correct store scope', async () => {
  await act(async () =>
    root.render(
      <ReportPanel
        target={{ messageId: 'market-message', storeId: 'seller-store' }}
        close={vi.fn()}
      />,
    ),
  );
  const button = [...host.querySelectorAll('button')].find(
    b => b.textContent === 'Report message',
  )!;
  expect(button.disabled).toBe(true);
  expect(mocks.submit).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLButtonElement>('[role="checkbox"]')!.click());
  await act(async () => button.click());
  expect(mocks.submit).toHaveBeenCalledExactlyOnceWith({
    messageId: 'market-message',
    storeId: 'seller-store',
    expectedFingerprint: 'b'.repeat(64),
    reason: 'spam',
    notes: '',
    consent: true,
  });
  expect(host.textContent).toContain('Report received');
});
test('sender cannot decide their request; recipient may decline without sending', async () => {
  await act(async () =>
    root.render(
      <RequestBanner
        threadId="thread"
        request={{ role: 'sender', state: 'pending', canIntroduce: false }}
      />,
    ),
  );
  expect(host.querySelector('button')).toBeNull();
  await act(async () =>
    root.render(
      <RequestBanner
        threadId="thread"
        request={{ role: 'recipient', state: 'pending', canIntroduce: false }}
      />,
    ),
  );
  await act(async () =>
    [...host.querySelectorAll('button')].find(b => b.textContent === 'Decline')!.click(),
  );
  expect(mocks.decide).toHaveBeenCalledExactlyOnceWith({ threadId: 'thread', action: 'decline' });
  expect(mocks.submit).not.toHaveBeenCalled();
});

test('native confirmation is bound to the inspected message version', async () => {
  const target = { messageId: 'selected' };
  await act(async () => root.render(<ReportPanel target={target} close={vi.fn()} />));
  await act(async () => host.querySelector<HTMLButtonElement>('[role="checkbox"]')!.click());
  mocks.preview.fingerprint = 'd'.repeat(64);
  await act(async () => root.render(<ReportPanel target={target} close={vi.fn()} />));
  expect(host.querySelector('[role="checkbox"]')?.getAttribute('aria-checked')).toBe('false');
  expect(
    [...host.querySelectorAll('button')].find(b => b.textContent === 'Report message')?.disabled,
  ).toBe(true);
  expect(mocks.submit).not.toHaveBeenCalled();
});
