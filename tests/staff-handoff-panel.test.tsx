import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { StaffHandoffGate } from '../src/inbox/handoff-panel';
import { useStaffSession } from '../src/inbox/use-staff-session';
import { loadPendingHandoff } from '../src/inbox/handoff-store';
import {
  staffHandoffCopy,
  staffWorkspaceKey,
  type StaffWorkspace,
} from '../src/dziri/messenger-staff.generated';

const h = vi.hoisted(() => ({
  values: new Map<string, string>(),
  action: vi.fn(),
  locale: 'en',
  failure: 'challenge_failed',
}));
vi.mock('react-native', async () => {
  const rn = await import('react-native-web');
  return { ...rn, Platform: { ...rn.Platform, OS: 'android' } };
});
const convex = { action: h.action };
vi.mock('convex/react', () => ({ useConvex: () => convex }));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({ locale: h.locale, rtl: h.locale === 'ar' }),
}));
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
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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
const ticket = { cipher: 'synthetic-cipher', iv: 'abcdefghijklmnop', keyVersion: 1 };
let root: Root, host: HTMLDivElement;
function Harness() {
  const session = useStaffSession(workspace, false, h.locale);
  return (
    <StaffHandoffGate
      workspace={workspace}
      reserve={session.reserveHandoff}
      sessionBusy={session.busy}>
      {(blocked, panel) => (
        <>
          <p data-testid="password-blocked">{String(blocked)}</p>
          {panel}
        </>
      )}
    </StaffHandoffGate>
  );
}
const show = (key = 'first') =>
  act(async () => {
    root.render(<Harness key={key} />);
  });
const button = (label: string) =>
  [...host.querySelectorAll<HTMLElement>('[role="button"]')].find(el => el.textContent === label)!;
const click = (label: string) =>
  act(async () => {
    button(label).click();
  });
const enter = (value: string) =>
  act(async () => {
    const input = host.querySelector('input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
beforeEach(() => {
  h.values.clear();
  h.action.mockReset();
  h.failure = 'challenge_failed';
  h.action.mockImplementation(async (ref, args) =>
    getFunctionName(ref).endsWith(':prepare')
      ? { state: 'prepared', ticket, expiresAt: Date.now() + 300_000 }
      : args.phase === 'begin'
        ? {
            state: 'mfa_required',
            challenge: 'c'.repeat(64),
            expires_at: Math.floor(Date.now() / 1000) + 300,
          }
        : args.phase === 'cancel'
          ? { state: 'cancelled' }
          : { state: h.failure },
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test.each(['en', 'fr', 'ar'])(
  'actual MFA/recovery controls retain one attempt and explain rejected factors in %s',
  async locale => {
    h.locale = locale;
    const copy = staffHandoffCopy(locale);
    await show();
    expect(h.action).not.toHaveBeenCalled();
    await click(copy.continue);
    const input = host.querySelector('input')!;
    expect(input.getAttribute('aria-label')).toBe(copy.code);
    expect(getComputedStyle(input).direction).toBe('ltr');
    expect(getComputedStyle(input).textAlign).toBe('left');
    await enter('123456');
    await click(copy.verify);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(copy.challengeFailed);
    expect(host.querySelector('input')?.value).toBe('');
    expect(button(copy.verify).getAttribute('aria-disabled')).toBe('true');
    expect(host.querySelector('[data-testid="password-blocked"]')?.textContent).toBe('true');
    expect(await loadPendingHandoff(workspace)).not.toBeNull();
    await click(copy.recovery);
    expect(host.querySelector('input')?.type).toBe('password');
    await enter('AB12CD34');
    await click(copy.verify);
    expect(
      h.action.mock.calls
        .filter(([, args]) => args.phase === 'verify')
        .map(([, args]) => ({ otp: args.otpCode, backup: args.backupCode })),
    ).toEqual([
      { otp: '123456', backup: undefined },
      { otp: undefined, backup: 'AB12CD34' },
    ]);
    expect(
      h.action.mock.calls.filter(([ref]) => getFunctionName(ref).endsWith(':prepare')),
    ).toHaveLength(1);
    expect([...h.values.values()].join('')).not.toMatch(/123456|AB12CD34|cccccccc/);
    await show('reloaded');
    expect(host.textContent).toContain(copy.review);
    expect(host.querySelector('input')).toBeNull();
    const calls = h.action.mock.calls.length;
    await click(copy.resume);
    expect(h.action).toHaveBeenCalledTimes(calls + 1);
    expect(h.action.mock.lastCall?.[1]).toEqual({ phase: 'begin', ticket });
    await click(copy.cancel);
    expect(host.textContent).toContain(copy.cancelled);
    expect(await loadPendingHandoff(workspace)).toBeNull();
    expect(host.querySelector('[data-testid="password-blocked"]')?.textContent).toBe('false');
  },
);

test('invalid attempts announce cancellation guidance and retain the attempt until explicit cancellation', async () => {
  h.locale = 'en';
  h.failure = 'invalid_attempt';
  const copy = staffHandoffCopy('en');
  await show();
  await click(copy.continue);
  await enter('123456');
  await click(copy.verify);
  expect(host.querySelector('[role="alert"]')?.textContent).toBe(copy.invalidAttempt);
  expect(await loadPendingHandoff(workspace)).not.toBeNull();
  expect(staffWorkspaceKey(workspace)).not.toContain('123456');
  await click(copy.cancel);
  expect(await loadPendingHandoff(workspace)).toBeNull();
});
