import React, { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { useReceiptObserver, useReceiptScope } from '../src/dziri/use-receipts';
import { ReceiptMessageBubble } from '../src/dziri/receipt-message-bubble';
import { MessageList } from '../src/dziri/message-list';
import {
  receiptIsViewable,
  createMarketplaceReceiptAdapter,
  type ReceiptScope,
} from '../src/dziri/message-receipts.generated';
import ViewabilityHelper from '../node_modules/@shopify/flash-list/src/recyclerview/viewability/ViewabilityHelper';
const state = vi.hoisted(() => ({
  send: vi.fn(async () => null),
  queries: [] as { name: string; args: unknown }[],
  summary: undefined as unknown,
  status: undefined as unknown,
  focused: true,
  online: true,
  list: undefined as any,
  instance: 0,
  nextInstance: 0,
  jump: vi.fn(async () => null),
  recompute: vi.fn(),
  appState: undefined as ((value: string) => void) | undefined,
}));
vi.mock('convex/react', () => ({
  useConvexConnectionState: () => ({ isWebSocketConnected: state.online }),
  useMutation: () => state.send,
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref);
    state.queries.push({ name, args });
    return args === 'skip' ? undefined : name.endsWith(':state') ? state.status : state.summary;
  },
}));
vi.mock('react-native', () => ({
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Pressable: ({ children, onPress }: React.PropsWithChildren<{ onPress: () => void }>) => (
    <button onClick={onPress}>{children}</button>
  ),
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, callback: (value: string) => void) => {
      state.appState = callback;
      return {
        remove: () => {
          state.appState = undefined;
        },
      };
    },
  },
}));
vi.mock('@react-navigation/native', () => ({ useIsFocused: () => state.focused }));
vi.mock('@shopify/flash-list', () => ({
  FlashList: (props: any) => {
    const [instance] = React.useState(() => ++state.nextInstance);
    state.instance = instance;
    React.useImperativeHandle(props.ref, () => ({
      scrollToIndex: state.jump,
      recomputeViewableItems: state.recompute,
    }));
    state.list = props;
    return (
      <div>
        {props.data.map((item: any, index: number) => (
          <div key={item.id}>{props.renderItem({ item, index })}</div>
        ))}
      </div>
    );
  },
}));
vi.mock('../src/dziri/message-action-dialog', () => ({ MessageActionDialog: () => null }));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
vi.mock('../src/dziri/ui', () => ({
  Notice: () => null,
  useColors: () => ({ text: '#000', secondary: '#777' }),
}));
vi.mock('../src/dziri/locale', () => ({ useLocale: () => ({ t: { empty: 'No messages' } }) }));
vi.mock('../src/dziri/message-bubble', () => ({
  MessageBubble: ({ message }: { message: { status?: string } }) => <span>{message.status}</span>,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const initial: ReceiptScope = {
  actorId: 'alice',
  threadId: 'group',
  epoch: 0,
  revision: 0,
  readGeneration: 0,
};
let root: Root, host: HTMLDivElement, visible: (ids: string[]) => void;
beforeEach(() => {
  vi.useFakeTimers();
  state.send.mockClear();
  state.queries = [];
  state.summary = undefined;
  state.status = undefined;
  state.focused = true;
  state.online = true;
  state.list = undefined;
  state.nextInstance = 0;
  state.instance = 0;
  state.jump.mockClear();
  state.recompute.mockReset();
  state.appState = undefined;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
function Probe({ scope = initial, enabled = true }: { scope?: ReceiptScope; enabled?: boolean }) {
  visible = useReceiptObserver({ scope, send: state.send }, enabled, ['same', 'hidden']);
  return null;
}
const render = (scope = initial, enabled = true) =>
  act(async () =>
    root.render(
      <StrictMode>
        <Probe scope={scope} enabled={enabled} />
      </StrictMode>,
    ),
  );
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const reads = () =>
  state.send.mock.calls
    .map(
      call => call[0] as unknown as { kind: string; messageIds: string[]; expectedActorId: string },
    )
    .filter(call => call.kind === 'read');

test('native StrictMode only reads exact viewable incoming IDs after dwell', async () => {
  await render();
  await act(async () => visible(['same']));
  await tick(499);
  expect(reads()).toEqual([]);
  await tick(1);
  expect(reads()).toMatchObject([{ messageIds: ['same'], expectedActorId: 'alice' }]);
});
test('a new actor in the same group must receive a fresh viewability observation', async () => {
  await render();
  await act(async () => visible(['same']));
  await tick(100);
  await render({ ...initial, actorId: 'bob' });
  await tick(1000);
  expect(reads().filter(call => call.expectedActorId === 'bob')).toEqual([]);
  await act(async () => visible(['same']));
  await tick(500);
  expect(reads().at(-1)).toMatchObject({ expectedActorId: 'bob', messageIds: ['same'] });
});

test('a queued callback from the previous native list cannot observe the replacement account', async () => {
  await render();
  const oldCallback = visible;
  await render({ ...initial, actorId: 'bob' });
  await act(async () => oldCallback(['same']));
  await tick(700);
  expect(reads()).toEqual([]);
  await act(async () => visible(['same']));
  await tick(500);
  expect(reads().at(-1)).toMatchObject({ expectedActorId: 'bob', messageIds: ['same'] });
});
test('offline and inactive native screens cancel dwell and restart it when active', async () => {
  await render();
  await act(async () => visible(['same']));
  await tick(250);
  await render(initial, false);
  await tick(900);
  expect(reads()).toEqual([]);
  await render();
  await tick(499);
  expect(reads()).toEqual([]);
  await tick(1);
  expect(reads()).toHaveLength(1);
});
test('native manual unread revision does not reread the bubble already on screen', async () => {
  await render();
  await act(async () => visible(['same']));
  await tick(500);
  await render({ ...initial, revision: 1 });
  await tick(1000);
  expect(reads()).toHaveLength(1);
});
function ScopeProbe({ supported = true }: { supported?: boolean }) {
  const result = useReceiptScope('alice', 'group', supported, true);
  return <span>{result.scope?.actorId ?? 'none'}</span>;
}
test('unsupported or stale-account summaries never grant a native observation scope', async () => {
  state.summary = { ...initial, actorId: 'bob', tracked: true, ready: true, count: 0 };
  await act(async () => root.render(<ScopeProbe supported={false} />));
  expect(host.textContent).toBe('none');
  expect(state.send).not.toHaveBeenCalled();
  expect(state.queries.every(row => row.args === 'skip')).toBe(true);
  await act(async () => root.render(<ScopeProbe />));
  expect(host.textContent).toBe('none');
});
test('native outgoing queries are visible-only and never convert local pending messages', async () => {
  const props = {
    mine: true,
    message: {
      id: 'out',
      senderId: 'alice',
      createdAt: 1,
      type: 'text',
      body: 'Fixture',
      status: 'sent',
    },
    selected: false,
    select: () => {},
  };
  state.status = 'read';
  await act(async () =>
    root.render(
      <ReceiptMessageBubble {...(props as never)} receiptScope={initial} receiptVisible />,
    ),
  );
  expect(host.textContent).toBe('read');
  await act(async () =>
    root.render(
      <ReceiptMessageBubble {...(props as never)} receiptScope={initial} receiptVisible={false} />,
    ),
  );
  expect(host.textContent).toBe('sent');
  expect(state.queries.at(-1)?.args).toBe('skip');
  await act(async () =>
    root.render(
      <ReceiptMessageBubble
        {...({ ...props, message: { ...props.message, local: true, status: 'pending' } } as never)}
        receiptScope={initial}
        receiptVisible
      />,
    ),
  );
  expect(host.textContent).toBe('pending');
  expect(state.queries.at(-1)?.args).toBe('skip');
});

const listRows = [
  { id: 'same', senderId: 'peer', body: 'Incoming', createdAt: 1, name: 'Peer', reactions: [] },
  {
    id: 'twin',
    senderId: 'peer',
    body: 'Same time, unseen',
    createdAt: 1,
    name: 'Peer',
    reactions: [],
  },
  {
    id: 'mine',
    senderId: 'alice',
    body: 'Own',
    createdAt: 1,
    name: 'Alice',
    status: 'sent' as const,
    reactions: [],
  },
];
test('actual native list uses exact IDs and suppresses legacy cursor callbacks', async () => {
  const legacyRead = vi.fn(async () => null),
    legacyDelivery = vi.fn(async () => null);
  const list = () =>
    act(async () =>
      root.render(
        <MessageList
          messages={listRows}
          myId="alice"
          retry={() => {}}
          read={legacyRead}
          delivered={legacyDelivery}
          exactReceipts={{ scope: initial, send: state.send }}
        />,
      ),
    );
  await list();
  expect(state.list.viewabilityConfig).toMatchObject({
    viewAreaCoveragePercentThreshold: 80,
    minimumViewTime: 0,
  });
  await act(async () =>
    state.list.onViewableItemsChanged({
      viewableItems: [
        { isViewable: true, item: listRows[0] },
        { isViewable: true, item: listRows[2] },
      ],
    }),
  );
  await tick(500);
  expect(reads()).toMatchObject([{ messageIds: ['same'] }]);
  expect(legacyRead).not.toHaveBeenCalled();
  expect(legacyDelivery).not.toHaveBeenCalled();
  state.focused = false;
  await list();
  await tick(1000);
  expect(reads()).toHaveLength(1);
});

test('actual native outgoing-only list consumes private activity without a fake message receipt', async () => {
  const receipts = createMarketplaceReceiptAdapter(
    {
      actorId: 'alice',
      conversationId: 'commerce',
      storeId: 'store',
      context: {
        expectedActorId: 'alice',
        readGeneration: 0,
        authorityKey: 'v1:' + 'a'.repeat(64),
      },
    },
    async () => null,
  );
  const source = {
    conversationId: 'commerce',
    storeId: 'store',
    observation: {
      expectedActorId: 'alice',
      readGeneration: 0,
      authorityKey: 'v1:' + 'a'.repeat(64),
    },
  };
  state.summary = { ...source, headId: 'reaction' };
  const list = (supported = true) =>
    act(async () =>
      root.render(
        <MessageList
          messages={[listRows[2]]}
          myId="alice"
          retry={() => {}}
          read={async () => null}
          delivered={async () => null}
          exactReceipts={{ ...receipts, state: 'inline' }}
          reactionInbox={supported}
        />,
      ),
    );
  await list(false);
  await tick(1000);
  expect(state.send).not.toHaveBeenCalled();
  await list();
  await tick(500);
  expect(state.send).toHaveBeenCalledExactlyOnceWith(source);
  state.focused = false;
  await list();
  state.send.mockClear();
  await tick(2000);
  expect(state.send).not.toHaveBeenCalled();
  state.focused = true;
  await list();
  await tick(499);
  await act(async () => state.appState?.('background'));
  await tick(1000);
  expect(state.send).not.toHaveBeenCalled();
});
test('actual native list without an activated exact scope cannot fall back to timestamp-prefix writes', async () => {
  const legacyRead = vi.fn(async () => null),
    legacyDelivery = vi.fn(async () => null);
  await act(async () =>
    root.render(
      <MessageList
        messages={listRows}
        myId="alice"
        retry={() => {}}
        read={legacyRead}
        delivered={legacyDelivery}
        exactReceipts={{ scope: null, send: state.send }}
      />,
    ),
  );
  await act(async () =>
    state.list.onViewableItemsChanged({ viewableItems: [{ isViewable: true, item: listRows[0] }] }),
  );
  await tick(1000);
  expect(state.send).not.toHaveBeenCalled();
  expect(legacyRead).not.toHaveBeenCalled();
  expect(legacyDelivery).not.toHaveBeenCalled();
});

test('granting receipt scope preserves the list instance and an existing search jump', async () => {
  const props = {
    messages: listRows,
    myId: 'alice',
    retry: () => {},
    read: async () => null,
    delivered: async () => null,
    focusMessageId: 'same',
  };
  await act(async () =>
    root.render(<MessageList {...props} exactReceipts={{ scope: null, send: state.send }} />),
  );
  await act(async () => state.list.onLoad());
  expect(state.jump).toHaveBeenCalledTimes(1);
  const instance = state.instance;
  state.recompute.mockImplementation(() =>
    state.list.onViewableItemsChanged({ viewableItems: [{ isViewable: true, item: listRows[0] }] }),
  );
  await act(async () =>
    root.render(<MessageList {...props} exactReceipts={{ scope: initial, send: state.send }} />),
  );
  expect(state.instance).toBe(instance);
  expect(state.jump).toHaveBeenCalledTimes(1);
  expect(state.recompute).toHaveBeenCalled();
  await tick(500);
  expect(reads().at(-1)).toMatchObject({ messageIds: ['same'], expectedActorId: 'alice' });
});

test('the actual FlashList visibility helper observes a tall bubble that fills the viewport', async () => {
  await act(async () =>
    root.render(
      <MessageList
        messages={listRows}
        myId="alice"
        retry={() => {}}
        read={async () => null}
        delivered={async () => null}
        exactReceipts={{ scope: initial, send: state.send }}
      />,
    ),
  );
  const helper = new ViewabilityHelper(state.list.viewabilityConfig, indices =>
    state.list.onViewableItemsChanged({
      viewableItems: indices.map(index => ({ isViewable: true, item: listRows[index] })),
    }),
  );
  await act(async () =>
    helper.updateViewableItems(
      false,
      0,
      { width: 300, height: 400 },
      () => ({ x: 0, y: 0, width: 300, height: 1000 }) as never,
      [0],
    ),
  );
  await tick(499);
  expect(reads()).toEqual([]);
  await tick(1);
  expect(reads()).toMatchObject([{ messageIds: ['same'] }]);
  helper.dispose();
});
test('a small partial bubble is not read until it is fully visible', async () => {
  await act(async () =>
    root.render(
      <MessageList
        messages={listRows}
        myId="alice"
        retry={() => {}}
        read={async () => null}
        delivered={async () => null}
        exactReceipts={{ scope: initial, send: state.send }}
      />,
    ),
  );
  const helper = new ViewabilityHelper(state.list.viewabilityConfig, indices =>
    state.list.onViewableItemsChanged({
      viewableItems: indices.map(index => ({ isViewable: true, item: listRows[index] })),
    }),
  );
  await act(async () =>
    helper.updateViewableItems(
      false,
      0,
      { width: 300, height: 400 },
      () => ({ x: 0, y: 320, width: 300, height: 100 }) as never,
      [0],
    ),
  );
  await tick(600);
  expect(reads()).toEqual([]);
  await act(async () =>
    helper.updateViewableItems(
      false,
      0,
      { width: 300, height: 400 },
      () => ({ x: 0, y: 300, width: 300, height: 100 }) as never,
      [0],
    ),
  );
  await tick(500);
  expect(reads()).toHaveLength(1);
  helper.dispose();
});

test('shared geometry and installed FlashList agree across short, tall and offscreen cells', async () => {
  await act(async () =>
    root.render(
      <MessageList
        messages={listRows}
        myId="alice"
        retry={() => {}}
        read={async () => null}
        delivered={async () => null}
        exactReceipts={{ scope: initial, send: state.send }}
      />,
    ),
  );
  for (const [height, y] of [
    [100, 0],
    [100, 320],
    [100, 300],
    [1000, 81],
    [1000, 80],
    [1000, -100],
    [2_000_000, -100],
    [100, 500],
    [100, -200],
  ]) {
    let actual: number[] = [];
    const helper = new ViewabilityHelper(state.list.viewabilityConfig, indices => {
      actual = indices;
    });
    helper.updateViewableItems(
      false,
      0,
      { width: 300, height: 400 },
      () => ({ x: 0, y, width: 300, height }) as never,
      [0],
    );
    const visible = Math.max(0, Math.min(y + height, 400) - Math.max(y, 0));
    expect(actual.includes(0)).toBe(receiptIsViewable(visible, height, 400));
    helper.dispose();
  }
});

test('Marketplace observes only incoming buyer-side rows and never queries personal receipt state', async () => {
  const wire = vi.fn(async (_kind: unknown, _args: unknown) => null);
  const adapter = createMarketplaceReceiptAdapter(
    {
      actorId: 'alice',
      conversationId: 'commerce',
      storeId: 'store',
      context: {
        expectedActorId: 'alice',
        readGeneration: 0,
        authorityKey: 'v1:' + 'a'.repeat(64),
      },
    },
    wire,
  );
  const rows = [
    {
      id: 'buyer',
      senderId: 'buyer',
      name: 'Buyer',
      body: 'Incoming',
      createdAt: 1,
      reactions: [],
    },
    {
      id: 'team',
      senderId: 'employee',
      name: 'Employee',
      body: 'Our side',
      createdAt: 2,
      status: 'sent' as const,
      reactions: [],
    },
  ];
  await act(async () =>
    root.render(
      <MessageList
        messages={rows}
        myId="alice"
        retry={() => {}}
        read={async () => null}
        delivered={async () => null}
        exactReceipts={{ ...adapter, state: 'inline' }}
      />,
    ),
  );
  await act(async () =>
    state.list.onViewableItemsChanged({
      viewableItems: rows.map(item => ({ isViewable: true, item })),
    }),
  );
  await tick(500);
  expect(wire.mock.calls.filter(call => call[0] === 'read').map(call => call[1])).toMatchObject([
    { messageIds: ['buyer'], observation: { expectedActorId: 'alice' } },
  ]);
  expect(state.queries.filter(call => call.name === 'messaging/receipts:state')).toEqual([]);
});
