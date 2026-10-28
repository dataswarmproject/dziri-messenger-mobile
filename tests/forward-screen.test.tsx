import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ForwardMessage } from '../src/dziri/forward-message';
const state = vi.hoisted(() => ({ rows: [] as object[], send: vi.fn(), complete: vi.fn() }));
vi.mock('convex/react', () => ({ useQuery: () => state.rows, useMutation: () => state.send }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'stable-forward-command' }));
vi.mock('react-native', () => ({
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollView: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ActivityIndicator: () => <span>Sending</span>,
  Pressable: ({
    children,
    onPress,
    disabled,
  }: React.PropsWithChildren<{ onPress: () => void; disabled?: boolean }>) => (
    <button onClick={onPress} disabled={disabled}>
      {children}
    </button>
  ),
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  TextInput: () => <input />,
}));
vi.mock('../src/dziri/icons', () => ({
  IconButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
vi.mock('../src/dziri/ui', () => ({ useColors: () => ({}) }));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({
    locale: 'en',
    rtl: false,
    t: {
      forwardMessage: 'Forward',
      forwardTo: 'Forward to',
      close: 'Close',
      recentConversations: 'Recent conversations',
      chooseConversation: 'Choose another conversation',
      actionFailed: 'Try again',
    },
  }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
const message = {
  id: 'original',
  senderId: 'peer',
  name: 'Peer',
  body: 'Private source',
  actionBody: 'Private source',
  type: 'text',
  createdAt: 1,
  reactions: [],
};
beforeEach(() => {
  state.rows = [
    { _id: 'source', type: 'dm', title: 'Source', encryption: 'server' },
    { _id: 'destination', title: 'Chosen recipient', type: 'dm', encryption: 'server' },
    { _id: 'frozen', title: 'Frozen', type: 'dm', isFrozen: true, encryption: 'server' },
    { _id: 'encrypted', title: 'Encrypted', type: 'dm', encryption: 'e2ee' },
  ];
  state.send.mockReset();
  state.complete.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const render = () =>
  act(async () =>
    root.render(
      <ForwardMessage
        message={message}
        threadId="source"
        complete={state.complete}
        back={() => {}}
      />,
    ),
  );
const button = (name: string) =>
  [...host.querySelectorAll('button')].find(node => node.textContent === name)!;
test('destination selection is separate from confirmation and failed retries reuse the exact command', async () => {
  state.send.mockRejectedValueOnce(new Error('private detail')).mockResolvedValueOnce('forwarded');
  await render();
  expect(host.textContent).not.toContain('Frozen');
  expect(host.textContent).not.toContain('Encrypted');
  await act(async () => button('Chosen recipient').click());
  expect(state.send).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Private source');
  await act(async () => button('Forward').click());
  expect(host.textContent).toContain('Try again');
  expect(host.textContent).not.toContain('private detail');
  await act(async () => button('Forward').click());
  expect(state.send.mock.calls[0][0]).toEqual(state.send.mock.calls[1][0]);
  expect(state.send).toHaveBeenCalledWith({
    messageId: 'original',
    targetThreadId: 'destination',
    expectedBody: 'Private source',
    clientMessageId: 'stable-forward-command',
  });
  expect(state.complete).toHaveBeenCalledOnce();
});
test('revoked or frozen destinations cannot remain selected', async () => {
  await render();
  await act(async () => button('Chosen recipient').click());
  state.rows = [];
  await render();
  expect(host.textContent).not.toContain('Forward to Chosen recipient');
  expect(state.send).not.toHaveBeenCalled();
});
