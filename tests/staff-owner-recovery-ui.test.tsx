import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StaffRecoveryEntry } from '../src/inbox/owner-recovery-entry';
import { savePendingHandoff, listPendingHandoffs } from '../src/inbox/handoff-store';
import {
  staffWorkspaceKey,
  staffRecoveryCopy,
  staffHandoffMessage,
  type StaffWorkspace,
} from '../src/dziri/messenger-staff.generated';
const h = vi.hoisted(() => ({ values: new Map<string, string>(), action: vi.fn(), locale: 'en' }));
vi.mock('react-native', async () => {
  const rn = await import('react-native-web');
  return {
    ...rn,
    Platform: { ...rn.Platform, OS: 'android' },
    AppState: { addEventListener: () => ({ remove() {} }) },
  };
});
vi.mock('convex/react', () => ({ useConvex: () => client }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => h.values.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => {
    h.values.set(k, v);
  },
  deleteItemAsync: async (k: string) => {
    h.values.delete(k);
  },
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_: string, v: string) => createHash('sha256').update(v).digest('hex'),
}));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({ locale: h.locale, rtl: h.locale === 'ar' }),
}));
vi.mock('../src/dziri/ui', () => ({
  useColors: () => ({
    text: '#fff',
    secondary: '#aaa',
    background: '#080909',
    surface: '#202020',
    border: '#444',
  }),
}));
vi.mock('../src/dziri/settings-icon', () => ({ SettingsIcon: () => <span aria-hidden="true" /> }));
vi.mock('../src/dziri/figma', () => ({
  FigmaIcon: () => <span aria-hidden="true" />,
  FigmaButton: ({ label, onPress }: any) => (
    <button aria-label={label} onClick={onPress}>
      {label}
    </button>
  ),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const client = { action: h.action };
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
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  h.values.clear();
  h.locale = 'en';
  h.action.mockReset();
  h.action.mockResolvedValue({ state: 'cancelled' });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const show = (actorId = w.actorId) =>
  act(async () => root.render(<StaffRecoveryEntry key={actorId} actorId={actorId} />));
async function click(label: string) {
  const button = [...document.querySelectorAll<HTMLElement>('button,[role="button"]')].find(
    e => e.getAttribute('aria-label') === label || e.textContent === label,
  );
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
}

test('settings recovery is available without any business role and sends nothing on mount', async () => {
  await savePendingHandoff(w, pending());
  await show();
  expect(host.textContent).toContain(staffRecoveryCopy('en').title);
  expect(h.action).not.toHaveBeenCalled();
  await click(staffRecoveryCopy('en').title);
  expect(document.body.textContent).toContain(staffRecoveryCopy('en').description);
  expect(document.body.textContent).not.toContain('synthetic-cipher');
  await click(staffRecoveryCopy('en').cancel);
  expect(h.action).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain(staffRecoveryCopy('en').confirm);
  expect(document.activeElement?.getAttribute('aria-label')).toBe(staffRecoveryCopy('en').keep);
  await click(staffRecoveryCopy('en').cancel);
  expect(h.action).toHaveBeenCalledOnce();
  expect(document.activeElement?.getAttribute('aria-label')).toBe(staffRecoveryCopy('en').reload);
  expect(document.body.textContent).toContain(staffRecoveryCopy('en').empty);
  expect(await listPendingHandoffs(w.actorId)).toEqual([]);
});
test('keeping the sign-in or closing the sheet does not cancel anything', async () => {
  const p = pending();
  await savePendingHandoff(w, p);
  await show();
  await click(staffRecoveryCopy('en').title);
  await click(staffRecoveryCopy('en').cancel);
  await click(staffRecoveryCopy('en').keep);
  expect(document.activeElement?.getAttribute('aria-label')).toBe(staffRecoveryCopy('en').cancel);
  await click(staffRecoveryCopy('en').close);
  expect(h.action).not.toHaveBeenCalled();
  expect(await listPendingHandoffs(w.actorId)).toEqual([p]);
});
test('uncertain cleanup keeps the attempt visible and retryable with localized feedback', async () => {
  h.action.mockResolvedValue({ state: 'revocation_unconfirmed' });
  const p = pending();
  await savePendingHandoff(w, p);
  await show();
  await click(staffRecoveryCopy('en').title);
  await click(staffRecoveryCopy('en').cancel);
  await click(staffRecoveryCopy('en').cancel);
  expect(document.body.textContent).toContain(staffHandoffMessage('revocation_unconfirmed', 'en'));
  expect(await listPendingHandoffs(w.actorId)).toEqual([p]);
  h.locale = 'ar';
  await show();
  expect(document.body.textContent).toContain(staffHandoffMessage('revocation_unconfirmed', 'ar'));
  expect(h.action).toHaveBeenCalledOnce();
});
test('account replacement removes old recovery data and late results cannot update the new account', async () => {
  let finish!: (value: unknown) => void;
  h.action.mockImplementation(
    () =>
      new Promise(r => {
        finish = r;
      }),
  );
  await savePendingHandoff(w, pending());
  await show();
  await click(staffRecoveryCopy('en').title);
  await click(staffRecoveryCopy('en').cancel);
  await click(staffRecoveryCopy('en').cancel);
  expect(h.action).toHaveBeenCalledOnce();
  await show('other-account');
  expect(document.body.textContent).not.toContain(staffRecoveryCopy('en').title);
  await act(async () => {
    finish({ state: 'cancelled' });
  });
  expect(document.body.textContent).not.toContain(staffRecoveryCopy('en').complete);
});
test('no saved attempts leaves the existing settings layout unchanged', async () => {
  await show();
  expect(host.textContent).toBe('');
  expect(h.action).not.toHaveBeenCalled();
});
