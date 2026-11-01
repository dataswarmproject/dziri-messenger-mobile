import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MessengerTabs } from '../src/shell';
import type { MessengerCapabilities, MessengerTab } from '../src/messenger-policy';

const state = vi.hoisted(() => ({ rtl: false }));
vi.mock('react-native', async () => import('react-native-web'));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({
    rtl: state.rtl,
    t: {
      friendsTab: 'Friends',
      marketplaceTab: 'Marketplace',
      teamView: 'Staff',
      profile: 'Profile',
    },
  }),
}));
vi.mock('../src/dziri/ui', () => ({
  useColors: () => ({ primary: '#111', secondary: '#666', text: '#111', border: '#eee' }),
  LanguageMenu: () => null,
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('../src/dziri/figma', () => ({ FigmaIcon: () => <span aria-hidden="true" /> }));
vi.mock('../src/dziri/icons', () => ({ Icon: () => <span aria-hidden="true" /> }));
vi.mock('expo-image', () => ({
  Image: ({ source }: { source: { uri: string } }) => <img alt="" src={source.uri} />,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const capabilities: MessengerCapabilities = {
  marketplace: true,
  staff: true,
  businesses: [{ id: 'business', name: 'Synthetic business', role: 'editor' }],
  stores: [],
};
const select = vi.fn();
let root: Root, host: HTMLDivElement;
const show = (
  profile: { image: string; open: () => void },
  available = capabilities,
  selected: MessengerTab = 'friends',
) =>
  act(async () =>
    root.render(
      <MessengerTabs
        capabilities={available}
        selected={selected}
        select={select}
        profile={profile}
      />,
    ),
  );
beforeEach(() => {
  state.rtl = false;
  select.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test.each([false, true])('profile remains separate from conversation tabs in RTL=%s', async rtl => {
  state.rtl = rtl;
  const open = vi.fn();
  await show({ image: 'https://synthetic.invalid/avatar-a.png', open });
  const tablist = host.querySelector<HTMLElement>('[role="tablist"]')!;
  const profile = host.querySelector<HTMLElement>('[aria-label="Profile"]')!;
  expect(tablist.contains(profile)).toBe(false);
  expect(profile.previousElementSibling).toBe(tablist);
  expect(getComputedStyle(tablist.parentElement!).flexDirection).toBe('row');
  expect(getComputedStyle(tablist).flexDirection).toBe(rtl ? 'row-reverse' : 'row');
  expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Friends');
  await act(async () => profile.click());
  expect(open).toHaveBeenCalledOnce();
  expect(select).not.toHaveBeenCalled();
  const staff = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    el => el.textContent === 'Staff',
  )!;
  await act(async () => staff.click());
  expect(select).toHaveBeenCalledWith('staff');
  expect(open).toHaveBeenCalledOnce();
});

test('revoked staff eligibility removes that tab while retaining the account profile', async () => {
  const profile = { image: 'https://synthetic.invalid/avatar-a.png', open: vi.fn() };
  await show(profile, capabilities, 'staff');
  expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Staff');
  await show(profile, { ...capabilities, businesses: [], staff: false });
  expect([...host.querySelectorAll('[role="tab"]')].map(el => el.textContent)).toEqual([
    'Friends',
    'Marketplace',
  ]);
  expect(host.querySelector('[aria-label="Profile"]')).not.toBeNull();
});

test('a replacement account uses its own avatar and profile action', async () => {
  const oldOpen = vi.fn(),
    newOpen = vi.fn();
  await show({ image: 'https://synthetic.invalid/avatar-a.png', open: oldOpen });
  await show({ image: 'https://synthetic.invalid/avatar-b.png', open: newOpen });
  const profile = host.querySelector<HTMLElement>('[aria-label="Profile"]')!;
  expect(profile.querySelector('img')?.getAttribute('src')).toBe(
    'https://synthetic.invalid/avatar-b.png',
  );
  await act(async () => profile.click());
  expect(newOpen).toHaveBeenCalledOnce();
  expect(oldOpen).not.toHaveBeenCalled();
  expect(select).not.toHaveBeenCalled();
});
