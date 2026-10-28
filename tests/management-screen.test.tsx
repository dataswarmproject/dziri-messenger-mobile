import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getFunctionName } from 'convex/server';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { GroupControls } from '../src/dziri/group-controls';
import { SafetyAction } from '../src/dziri/safety';
import { ThreadActions } from '../src/dziri/thread-actions';

const state = vi.hoisted(() => ({
  members: [] as object[],
  blocked: false,
  mutate: vi.fn(),
  close: vi.fn(),
  leave: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useQuery: (ref: never) =>
    getFunctionName(ref) === 'users:getMe' ? { _id: 'actor' } : { blocked: state.blocked },
  usePaginatedQuery: () => ({ results: state.members, status: 'Exhausted', loadMore: vi.fn() }),
  useMutation: (ref: never) => (args: object) => state.mutate(getFunctionName(ref), args),
}));
vi.mock('react-native', () => ({
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollView: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Modal: ({ children }: React.PropsWithChildren) => <div role="dialog">{children}</div>,
  ActivityIndicator: () => <span>Saving</span>,
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
    <button aria-label={accessibilityLabel} onClick={onPress} disabled={disabled}>
      {children}
    </button>
  ),
}));
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
vi.mock('../src/dziri/icons', () => ({
  IconButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button aria-label={label} onClick={onPress} disabled={disabled}>
      {label}
    </button>
  ),
}));
vi.mock('../src/dziri/ui', () => ({ useColors: () => ({}) }));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({ rtl: false, t: new Proxy({}, { get: (_, key) => String(key) }) }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  state.members = [
    { userId: 'actor', name: 'Me', role: 'owner', available: true },
    { userId: 'peer', name: 'Peer', role: 'member', available: true },
  ];
  state.blocked = false;
  state.mutate.mockReset();
  state.close.mockClear();
  state.leave.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const button = (name: string) =>
  [...host.querySelectorAll('button')].find(node => node.textContent === name)!;
const group = (role = 'owner', writable = true) =>
  act(async () =>
    root.render(
      <GroupControls
        threadId="group"
        title="Group"
        role={role}
        writable={writable}
        leave={state.leave}
      />,
    ),
  );

test('group ownership changes need confirmation and disappear when permission is revoked', async () => {
  await group();
  await act(async () => button('more: Peer').click());
  await act(async () => button('transferOwnership').click());
  expect(state.mutate).not.toHaveBeenCalled();
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  await group('member');
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).not.toContain('transferOwnership');
  expect(state.mutate).not.toHaveBeenCalled();
});
test('group role operation sends the selected member only after confirmation', async () => {
  state.mutate.mockResolvedValue(null);
  await group();
  await act(async () => button('more: Peer').click());
  await act(async () => button('makeAdmin').click());
  await act(async () => button('confirm').click());
  expect(state.mutate).toHaveBeenCalledWith('messaging/groups:updateMember', {
    threadId: 'group',
    userId: 'peer',
    action: 'promote',
  });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});
test('a block confirmation keeps its original intent when live state changes and hides private errors', async () => {
  const render = () => act(async () => root.render(<SafetyAction userId="peer" name="Peer" />));
  state.mutate
    .mockRejectedValueOnce(new Error('private backend detail'))
    .mockResolvedValueOnce(null);
  await render();
  await act(async () => button('blockAccount').click());
  expect(state.mutate).not.toHaveBeenCalled();
  state.blocked = true;
  await render();
  await act(async () => button('confirm').click());
  expect(state.mutate.mock.calls[0]).toEqual([
    'messaging/moderationDecisions:blockUser',
    { blockedUserId: 'peer' },
  ]);
  expect(host.textContent).toContain('actionFailed');
  expect(host.textContent).not.toContain('private backend detail');
  await act(async () => button('confirm').click());
  expect(state.mutate.mock.calls[1]).toEqual(state.mutate.mock.calls[0]);
});
test('inbox organization waits for acknowledgement, locks repeat clicks and uses desired state', async () => {
  let resolve!: () => void;
  state.mutate.mockImplementation(
    () =>
      new Promise<void>(done => {
        resolve = done;
      }),
  );
  await act(async () =>
    root.render(
      <ThreadActions
        threadId="thread"
        pinned={false}
        archived={false}
        unread
        close={state.close}
        details={() => {}}
      />,
    ),
  );
  await act(async () => button('pinChat').click());
  expect(state.close).not.toHaveBeenCalled();
  expect(button('archiveChat').disabled).toBe(true);
  await act(async () => button('pinChat').click());
  expect(state.mutate).toHaveBeenCalledOnce();
  expect(state.mutate).toHaveBeenCalledWith('messaging/organization:updateThread', {
    threadId: 'thread',
    action: 'pin',
    value: true,
  });
  await act(async () => resolve());
  expect(state.close).toHaveBeenCalledOnce();
});
