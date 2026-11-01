import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getFunctionName } from 'convex/server';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { SwipeConversation } from '../src/dziri/swipe-conversation';
const state = vi.hoisted(() => ({
  locale: 'en',
  actor: 'alice',
  mutate: vi.fn(),
  profile: vi.fn(),
  safetyCapability: 1 as number | undefined,
  safetyQueryFails: false,
  safetyQueries: 0,
  pan: {} as Record<string, (...args: unknown[]) => unknown>,
}));
vi.mock('react-native', () => {
  const View = ({ children, style }: React.PropsWithChildren<{ style?: object }>) => (
    <div data-style={JSON.stringify(style)}>{children}</div>
  );
  class Value {
    constructor(public value: number) {}
    setValue(value: number) {
      this.value = value;
    }
  }
  return {
    View,
    ScrollView: View,
    Platform: { OS: 'web' },
    Animated: {
      Value,
      View,
      spring: (value: Value, options: { toValue: number }) => ({
        start: () => value.setValue(options.toValue),
      }),
    },
    PanResponder: {
      create: (handlers: typeof state.pan) => {
        state.pan = handlers;
        return { panHandlers: {} };
      },
    },
    ActivityIndicator: () => <span>Saving</span>,
    Modal: ({ children }: React.PropsWithChildren) => <div role="dialog">{children}</div>,
    Pressable: ({
      children,
      onPress,
      disabled,
      accessibilityLabel,
    }: React.PropsWithChildren<{
      onPress: () => void;
      disabled?: boolean;
      accessibilityLabel?: string;
    }>) => (
      <button aria-label={accessibilityLabel} disabled={disabled} onClick={onPress}>
        {children}
      </button>
    ),
  };
});
vi.mock('../src/dziri/typography', () => ({
  Text: ({
    children,
    accessibilityRole,
  }: React.PropsWithChildren<{ accessibilityRole?: string }>) => (
    <span role={accessibilityRole === 'alert' ? 'alert' : undefined}>{children}</span>
  ),
  TextInput: () => <input />,
}));
vi.mock('../src/dziri/screen-parts', () => ({
  PersonAvatar: () => null,
  ScreenHeading: () => null,
}));
vi.mock('../src/dziri/icons', () => ({ IconButton: () => null }));
vi.mock('../src/dziri/iconly', () => ({
  IconlyGlyph: ({ name }: { name: string }) => <i data-icon={name} />,
}));
vi.mock('../src/dziri/ui', () => ({
  useColors: () => ({
    surface: '#eee',
    background: '#fff',
    text: '#000',
    secondary: '#777',
    primary: '#111',
    actionSurface: '#fff',
  }),
}));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({
    locale: state.locale,
    rtl: state.locale === 'ar',
    t: new Proxy({}, { get: (_, key) => String(key) }),
  }),
}));
vi.mock('convex/react', () => ({
  useQuery: (ref: never, args: unknown) => {
    if (args === 'skip') return undefined;
    const name = getFunctionName(ref);
    if (name === 'users:getMe') return { _id: state.actor };
    if (name === 'messaging/messenger:capabilities')
      return { features: { historyDeletion: 1, safety: state.safetyCapability } };
    if (name === 'messaging/messenger:thread')
      return { _id: 'thread', historyRevision: 0, mutedUntil: 0 };
    if (name === 'messaging/safety:state') {
      state.safetyQueries += 1;
      if (state.safetyQueryFails) throw new Error('Synthetic optional safety endpoint failure');
    }
    return { blocked: false };
  },
  useMutation: (ref: never) => (args: object) => state.mutate(getFunctionName(ref), args),
  usePaginatedQuery: () => ({ results: [], status: 'Exhausted', loadMore: vi.fn() }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
async function render() {
  await act(async () =>
    root.render(
      <SwipeConversation
        threadId="thread"
        details={() => {}}
        userId="bob"
        title="Bob"
        profile={state.profile}>
        {() => <button>Bob conversation</button>}
      </SwipeConversation>,
    ),
  );
}
async function swipe(dx = -100, dy = 0) {
  await act(async () => {
    state.pan.onPanResponderRelease({}, { dx, dy });
  });
}
const action = (label: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
beforeEach(() => {
  state.locale = 'en';
  state.actor = 'alice';
  state.mutate.mockReset().mockResolvedValue(null);
  state.profile.mockReset();
  state.safetyCapability = 1;
  state.safetyQueryFails = false;
  state.safetyQueries = 0;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
test('a left swipe reveals mute/delete/profile/block; vertical scrolling stays available', async () => {
  await render();
  expect(state.pan.onMoveShouldSetPanResponder({}, { dx: -60, dy: 4 })).toBe(true);
  expect(state.pan.onMoveShouldSetPanResponder({}, { dx: -10, dy: 60 })).toBe(false);
  for (const name of ['Mute', 'Delete', 'Profile', 'Block'])
    expect(action(name).disabled).toBe(true);
  await swipe();
  for (const name of ['Mute', 'Delete', 'Profile', 'Block'])
    expect(action(name).disabled).toBe(false);
  expect(state.mutate).not.toHaveBeenCalled();
});
test('mute uses the existing canonical mutation and profile opens the selected person', async () => {
  await render();
  await swipe();
  const now = Date.now();
  await act(async () => action('Mute').click());
  expect(state.mutate).toHaveBeenCalledWith('messaging/threads:setMuted', {
    threadId: 'thread',
    untilMs: expect.any(Number),
  });
  expect(state.mutate.mock.calls[0][1].untilMs).toBeGreaterThanOrEqual(now + 86400000);
  await swipe();
  await act(async () => action('Profile').click());
  expect(state.profile).toHaveBeenCalledOnce();
});
test('deletion is confirmed and bound to the displayed account/history', async () => {
  await render();
  await swipe();
  await act(async () => action('Delete').click());
  expect(state.mutate).not.toHaveBeenCalled();
  const confirm = [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
    node => node.textContent === 'Delete',
  )!;
  await act(async () => confirm.click());
  expect(state.mutate).toHaveBeenCalledWith('messaging/organization:deleteHistory', {
    threadId: 'thread',
    expectedActorId: 'alice',
    throughRevision: 0,
  });
});
test('switching accounts invalidates an open confirmation', async () => {
  await render();
  await swipe();
  await act(async () => action('Delete').click());
  state.actor = 'charlie';
  await render();
  const confirm = [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
    node => node.textContent === 'Delete',
  )!;
  expect(confirm.disabled).toBe(true);
  await act(async () => confirm.click());
  expect(state.mutate).not.toHaveBeenCalled();
});
test('block uses the existing confirmation instead of changing the account on swipe', async () => {
  await render();
  await swipe();
  await act(async () => action('Block').click());
  expect(state.mutate).not.toHaveBeenCalled();
  const confirm = [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
    node => node.textContent === 'confirm',
  )!;
  expect(confirm).toBeTruthy();
  await act(async () => confirm.click());
  expect(state.mutate).toHaveBeenCalledWith('messaging/moderationDecisions:blockUser', {
    blockedUserId: 'bob',
  });
});
test('Arabic mirrors the gesture and uses the same action set', async () => {
  state.locale = 'ar';
  await render();
  expect(state.pan.onMoveShouldSetPanResponder({}, { dx: 60, dy: 4 })).toBe(true);
  await swipe(100);
  for (const name of ['كتم', 'حذف', 'الملف', 'حظر']) expect(action(name).disabled).toBe(false);
});

test.each([
  { backend: 'unadvertised', capability: undefined },
  { backend: 'advertised but failing', capability: 1 },
])('a swipe preserves the conversation and unrelated actions with $backend safety', async ({ capability }) => {
  // Convex useQuery throws endpoint failures during render. Only this optional
  // safety endpoint fails; thread/profile/capabilities remain available.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state.safetyCapability = capability;
  state.safetyQueryFails = true;
  await render();
  expect(host.textContent).toContain('Bob conversation');
  await expect(swipe()).resolves.toBeUndefined();

  expect(host.textContent).toContain('Bob conversation');
  expect(action('Block').disabled).toBe(true);
  expect(action('Mute').disabled).toBe(false);
  expect(action('Profile').disabled).toBe(false);
  if (capability === undefined) expect(state.safetyQueries).toBe(0);
  expect(state.mutate).not.toHaveBeenCalled();
  await act(async () => action('Block').click());
  expect(state.mutate).not.toHaveBeenCalled();

  await act(async () => action('Profile').click());
  expect(state.profile).toHaveBeenCalledOnce();
  await expect(swipe()).resolves.toBeUndefined();
  await act(async () => action('Mute').click());
  expect(state.mutate).toHaveBeenCalledWith('messaging/threads:setMuted', {
    threadId: 'thread', untilMs: expect.any(Number),
  });
  expect(host.textContent).toContain('Bob conversation');
});
