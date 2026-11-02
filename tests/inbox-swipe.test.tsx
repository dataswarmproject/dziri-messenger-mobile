import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getFunctionName } from 'convex/server';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { SwipeConversation } from '../src/dziri/swipe-conversation';
import { SafetyAction } from '../src/dziri/safety';
const state = vi.hoisted(() => ({
  locale: 'en',
  actor: 'alice',
  blocked: false,
  mutate: vi.fn(),
  prepare: vi.fn(),
  profile: vi.fn(),
  safetyCapability: 1 as number | undefined,
  safetyQueryFails: false,
  safetyQueries: 0,
  safetyActor: null as string | null,
  missingSafetyOwner: false,
  actorLoading: false,
  marketplaceMuteCapability: 1 as number | undefined,
  marketplaceQueries: 0,
  marketplaceMutedUntil: 0,
  marketplaceActor: 'alice',
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
    if (name === 'users:getMe') return state.actorLoading ? undefined : { _id: state.actor };
    if (name === 'messaging/messenger:capabilities')
      return {
        features: {
          historyDeletion: 1,
          safety: state.safetyCapability,
          marketplaceMute: state.marketplaceMuteCapability,
        },
      };
    if (name === 'marketplaceInbox:state') {
      state.marketplaceQueries++;
      return {
        mutedUntil: state.marketplaceMutedUntil,
        peerId: 'bob',
        commandContext: {
          expectedActorId: state.marketplaceActor,
          authorityKey: 'v1:' + 'f'.repeat(64),
        },
      };
    }
    if (name === 'messaging/messenger:thread')
      return { _id: 'thread', historyRevision: 0, mutedUntil: 0 };
    if (name === 'messaging/safety:state') {
      state.safetyQueries += 1;
      if (state.safetyQueryFails) throw new Error('Synthetic optional safety endpoint failure');
    }
    return {
      blocked: state.blocked,
      expectedActorId: state.missingSafetyOwner ? undefined : (state.safetyActor ?? state.actor),
    };
  },
  useMutation: (ref: never) => (args: object) =>
    getFunctionName(ref) === 'messaging/safety:prepareDecision'
      ? state.prepare(args)
      : state.mutate(getFunctionName(ref), args),
  usePaginatedQuery: () => ({ results: [], status: 'Exhausted', loadMore: vi.fn() }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
async function render(marketplace = false, threadId = 'thread') {
  await act(async () =>
    root.render(
      <SwipeConversation
        threadId={marketplace ? undefined : threadId}
        commerce={marketplace ? { conversationId: 'commerce', storeId: 'store' } : undefined}
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
  state.blocked = false;
  state.mutate.mockReset().mockResolvedValue(null);
  state.prepare.mockReset().mockImplementation(async (args: { expectedActorId: string }) => ({
    blocked: state.blocked,
    expectedActorId: args.expectedActorId,
    decisionKey: 'v1:' + 'a'.repeat(64),
  }));
  state.profile.mockReset();
  state.safetyCapability = 1;
  state.safetyQueryFails = false;
  state.safetyQueries = 0;
  state.safetyActor = null;
  state.missingSafetyOwner = false;
  state.actorLoading = false;
  state.marketplaceMuteCapability = 1;
  state.marketplaceQueries = 0;
  state.marketplaceMutedUntil = 0;
  state.marketplaceActor = 'alice';
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

test('Marketplace mute uses its scoped canonical endpoint and preserves unavailable delete/block', async () => {
  await render(true);
  await swipe();
  expect(action('Delete').disabled).toBe(true);
  expect(action('Block').disabled).toBe(true);
  await act(async () => action('Mute').click());
  expect(state.mutate).toHaveBeenCalledWith('marketplaceInbox:setMuted', {
    conversationId: 'commerce',
    storeId: 'store',
    untilMs: expect.any(Number),
    commandContext: { expectedActorId: 'alice', authorityKey: 'v1:' + 'f'.repeat(64) },
  });
  await swipe();
  await act(async () => action('Profile').click());
  expect(state.profile).toHaveBeenCalledOnce();
});
test('Marketplace without mute capability does not query an unavailable endpoint', async () => {
  state.marketplaceMuteCapability = undefined;
  await render(true);
  await swipe();
  expect(state.marketplaceQueries).toBe(0);
  expect(action('Mute').disabled).toBe(true);
  expect(action('Profile').disabled).toBe(false);
  expect(state.mutate).not.toHaveBeenCalled();
});
test('Marketplace unmute sends zero without changing its captured account/store scope', async () => {
  state.marketplaceMutedUntil = Date.now() + 86400000;
  await render(true);
  await swipe();
  await act(async () => action('Unmute').click());
  expect(state.mutate.mock.calls[0][1]).toMatchObject({
    conversationId: 'commerce',
    storeId: 'store',
    untilMs: 0,
  });
});
test('a lagging Marketplace state cannot mute after the current account changes', async () => {
  await render(true);
  await swipe();
  state.actor = 'charlie';
  await render(true);
  expect(action('Mute').disabled).toBe(true);
  await act(async () => action('Mute').click());
  expect(state.mutate).not.toHaveBeenCalled();
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
test('a recycled row cannot confirm deletion for its previous conversation', async () => {
  await render();
  await swipe();
  await act(async () => action('Delete').click());
  await render(false, 'another-thread');
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
    expectedDecisionKey: 'v1:' + 'a'.repeat(64),
    blockedUserId: 'bob',
    expectedActorId: 'alice',
  });
});

test.each([false, true])(
  'changing accounts retires the previous safety confirmation (blocked=%s)',
  async blocked => {
    state.blocked = blocked;
    await render();
    await swipe();
    await act(async () => action(blocked ? 'Unblock' : 'Block').click());
    expect(host.querySelector('[role="dialog"]')).toBeTruthy();
    state.actor = 'charlie';
    await render();
    const confirm = [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      node => node.textContent === 'confirm',
    );
    if (confirm) await act(async () => confirm.click());
    expect(state.mutate).not.toHaveBeenCalled();
  },
);

test.each(['lagging', 'unadvertised', 'loading'])(
  '%s ownership keeps block unavailable',
  async kind => {
    if (kind === 'lagging') state.safetyActor = 'other-account';
    if (kind === 'unadvertised') state.missingSafetyOwner = true;
    if (kind === 'loading') state.actorLoading = true;
    await render();
    await swipe();
    expect(action('Block').disabled).toBe(true);
    await act(async () => action('Block').click());
    expect(state.mutate).not.toHaveBeenCalled();
  },
);

test('unknown identity retires confirmation even when the same account returns', async () => {
  await render();
  await swipe();
  await act(async () => action('Block').click());
  state.actorLoading = true;
  await render();
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  state.actorLoading = false;
  await render();
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(state.mutate).not.toHaveBeenCalled();
});

test('a confirmed safety action remains usable after React effect replay', async () => {
  await act(async () =>
    root.render(
      <React.StrictMode>
        <SafetyAction userId="bob" name="Bob" />
      </React.StrictMode>,
    ),
  );
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  const confirm = [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
    node => node.textContent === 'confirm',
  )!;
  await act(async () => confirm.click());
  expect(state.mutate).toHaveBeenCalledWith('messaging/moderationDecisions:blockUser', {
    blockedUserId: 'bob',
    expectedActorId: 'alice',
    expectedDecisionKey: 'v1:' + 'a'.repeat(64),
  });
});

test.each([
  { reject: false, back: false },
  { reject: true, back: false },
  { reject: false, back: true },
  { reject: true, back: true },
])(
  'late old-account completion cannot close a newer confirmation ($reject, ABA=$back)',
  async ({ reject, back }) => {
    let done!: () => void;
    state.mutate.mockImplementationOnce(
      () =>
        new Promise((resolve, fail) => {
          done = () => (reject ? fail(new Error('private old error')) : resolve(null));
        }),
    );
    await render();
    await swipe();
    await act(async () => action('Block').click());
    const confirm = () =>
      [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
        node => node.textContent === 'confirm',
      )!;
    await act(async () => confirm().click());
    state.actor = 'charlie';
    await render();
    if (back) {
      state.actor = 'alice';
      await render();
    }
    await act(async () => action('Block').click());
    await act(async () => done());
    expect(host.querySelector('[role="dialog"]')).toBeTruthy();
    expect(host.textContent).not.toContain('private old error');
    expect(confirm().disabled).toBe(false);
    await act(async () => confirm().click());
    expect(state.mutate.mock.calls[1][1]).toEqual({
      blockedUserId: 'bob',
      expectedDecisionKey: 'v1:' + 'a'.repeat(64),
      expectedActorId: back ? 'alice' : 'charlie',
    });
  },
);
test('Arabic mirrors the gesture and uses the same action set', async () => {
  state.locale = 'ar';
  await render();
  expect(state.pan.onMoveShouldSetPanResponder({}, { dx: 60, dy: 4 })).toBe(true);
  await swipe(100);
  for (const name of ['كتم', 'حذف', 'الملف', 'حظر']) expect(action(name).disabled).toBe(false);
});

test("an old completion cannot unlock another account's in-flight confirmation", async () => {
  let oldDone!: () => void, newDone!: () => void;
  state.mutate
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          oldDone = () => resolve(null);
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          newDone = () => resolve(null);
        }),
    );
  const confirm = () =>
    [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      n => n.textContent === 'confirm',
    )!;
  await render();
  await swipe();
  await act(async () => action('Block').click());
  await act(async () => confirm().click());
  state.actor = 'charlie';
  await render();
  await act(async () => action('Block').click());
  await act(async () => confirm().click());
  await act(async () => oldDone());
  expect(confirm().disabled).toBe(true);
  await act(async () => confirm().click());
  expect(state.mutate).toHaveBeenCalledTimes(2);
  await act(async () => newDone());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

test('unmounting retires late navigation callbacks', async () => {
  let done!: () => void;
  const onComplete = vi.fn();
  state.mutate.mockImplementation(
    () =>
      new Promise(resolve => {
        done = () => resolve(null);
      }),
  );
  await act(async () =>
    root.render(<SafetyAction userId="bob" name="Bob" onComplete={onComplete} />),
  );
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  const confirm = [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
    n => n.textContent === 'confirm',
  )!;
  await act(async () => confirm.click());
  await act(async () => root.unmount());
  await act(async () => done());
  expect(onComplete).not.toHaveBeenCalled();
});

test.each([
  { backend: 'unadvertised', capability: undefined },
  { backend: 'advertised but failing', capability: 1 },
])(
  'a swipe preserves the conversation and unrelated actions with $backend safety',
  async ({ capability }) => {
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
      threadId: 'thread',
      untilMs: expect.any(Number),
    });
    expect(host.textContent).toContain('Bob conversation');
  },
);

async function showPreparedSafety() {
  await act(async () => root.render(<SafetyAction userId="bob" name="Bob" />));
}
function safetyTextButton(text: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    node => node.textContent === text,
  )!;
}
test.each(['different account', 'identity gap'])(
  'an optional safety failure retires across %s without reusing failed account state',
  async transition => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      state.safetyQueryFails = true;
      await showPreparedSafety();
      expect(safetyTextButton('blockAccount').disabled).toBe(true);
      expect(host.textContent).not.toContain('Synthetic optional');
      state.safetyQueryFails = false;
      await showPreparedSafety();
      expect(safetyTextButton('blockAccount').disabled).toBe(true);
      if (transition === 'identity gap') {
        state.actorLoading = true;
        await showPreparedSafety();
        expect(safetyTextButton('blockAccount').disabled).toBe(true);
        state.actorLoading = false;
      } else state.actor = 'charlie';
      await showPreparedSafety();
      expect(safetyTextButton('blockAccount').disabled).toBe(false);
      await act(async () => safetyTextButton('blockAccount').click());
      expect(state.prepare).toHaveBeenCalledExactlyOnceWith({
        otherUserId: 'bob',
        expectedActorId: state.actor,
      });
      await act(async () => safetyTextButton('cancel').click());
      expect(state.mutate).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  },
);

test('cancelled preparation cannot reopen a dialog or unlock a newer preparation', async () => {
  let first!: (value: unknown) => void, second!: (value: unknown) => void;
  state.prepare
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          first = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          second = resolve;
        }),
    );
  await showPreparedSafety();
  await act(async () => safetyTextButton('blockAccount').click());
  expect(safetyTextButton('Loading…').disabled).toBe(true);
  await act(async () => safetyTextButton('cancel').click());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => safetyTextButton('blockAccount').click());
  await act(async () =>
    first({ blocked: false, expectedActorId: 'alice', decisionKey: 'v1:' + 'a'.repeat(64) }),
  );
  expect(safetyTextButton('Loading…').disabled).toBe(true);
  expect(state.mutate).not.toHaveBeenCalled();
  await act(async () =>
    second({ blocked: false, expectedActorId: 'alice', decisionKey: 'v1:' + 'b'.repeat(64) }),
  );
  await act(async () => safetyTextButton('confirm').click());
  expect(state.mutate).toHaveBeenCalledWith('messaging/moderationDecisions:blockUser', {
    blockedUserId: 'bob',
    expectedActorId: 'alice',
    expectedDecisionKey: 'v1:' + 'b'.repeat(64),
  });
});
test('preparation cannot silently reverse the chosen action and retry needs a fresh review', async () => {
  state.prepare.mockResolvedValueOnce({
    blocked: true,
    expectedActorId: 'alice',
    decisionKey: 'v1:' + 'a'.repeat(64),
  });
  await showPreparedSafety();
  await act(async () => safetyTextButton('blockAccount').click());
  expect(safetyTextButton('confirm').disabled).toBe(true);
  expect(host.textContent).toContain('Close and reopen');
  expect(state.mutate).not.toHaveBeenCalled();
  await act(async () => safetyTextButton('cancel').click());
  state.blocked = true;
  await showPreparedSafety();
  await act(async () => safetyTextButton('unblockAccount').click());
  await act(async () => safetyTextButton('confirm').click());
  expect(state.mutate).toHaveBeenCalledWith(
    'messaging/moderationDecisions:unblockUser',
    expect.objectContaining({ expectedDecisionKey: 'v1:' + 'a'.repeat(64) }),
  );
});
test('late preparation from an earlier account lifetime cannot replace a fresh decision', async () => {
  let finish!: (value: unknown) => void;
  state.prepare.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await showPreparedSafety();
  await act(async () => safetyTextButton('blockAccount').click());
  state.actor = 'charlie';
  await showPreparedSafety();
  state.actor = 'alice';
  await showPreparedSafety();
  await act(async () => safetyTextButton('blockAccount').click());
  await act(async () =>
    finish({ blocked: false, expectedActorId: 'alice', decisionKey: 'v1:' + 'b'.repeat(64) }),
  );
  await act(async () => safetyTextButton('confirm').click());
  expect(state.mutate).toHaveBeenCalledWith(
    'messaging/moderationDecisions:blockUser',
    expect.objectContaining({ expectedDecisionKey: 'v1:' + 'a'.repeat(64) }),
  );
});
test.each([undefined, 'invalid'])(
  'unproven preparation key %s never falls back to an unscoped command',
  async decisionKey => {
    state.prepare.mockResolvedValueOnce({ blocked: false, expectedActorId: 'alice', decisionKey });
    await showPreparedSafety();
    await act(async () => safetyTextButton('blockAccount').click());
    expect(safetyTextButton('confirm').disabled).toBe(true);
    expect(state.mutate).not.toHaveBeenCalled();
  },
);
