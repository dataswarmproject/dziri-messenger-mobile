import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { CommerceScreen } from '../src/dziri/commerce';
const state = vi.hoisted(() => ({
  actor: 'alice',
  drafts: [] as any[],
  context: undefined as any,
  props: undefined as any,
  queued: undefined as any,
  composer: undefined as any,
  composerInstance: 0,
  nextComposerInstance: 0,
  writeSupported: true,
  discard: vi.fn(async () => true),
  wire: vi.fn(async (_name: string, _args: unknown) => null),
}));
vi.mock('convex/react', () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name === 'users:getMe') return { _id: state.actor, name: 'Synthetic' };
    if (name === 'marketplaceMessages:getConversation')
      return {
        otherName: 'Buyer',
        storeName: 'Store',
        viewerSide: 'seller',
        receiptContext: state.context,
        writeContext: state.context
          ? {
              expectedActorId: state.context.expectedActorId,
              authorityKey: state.context.authorityKey,
            }
          : null,
      };
    return {
      features: {
        historyPages: 1,
        reactionInbox: 1,
        marketplaceWriteScope: state.writeSupported ? 1 : 0,
      },
    };
  },
  usePaginatedQuery: () => ({
    status: 'Exhausted',
    results: [
      {
        _id: 'incoming',
        senderId: 'buyer',
        senderSide: 'buyer',
        senderName: 'Buyer',
        content: 'Synthetic',
        createdAt: 1,
        reactions: [],
      },
      {
        _id: 'team',
        clientMessageId: 'foreign-key',
        senderId: 'employee',
        senderSide: 'seller',
        senderName: 'Employee',
        content: 'Our store',
        createdAt: 2,
        reactions: [],
      },
    ],
  }),
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => (args: unknown) =>
    state.wire(getFunctionName(ref), args),
}));
vi.mock('react-native', () => ({
  KeyboardAvoidingView: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Platform: { OS: 'web' },
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
vi.mock('../src/dziri/locale', () => ({ useLocale: () => ({ locale: 'en', t: {} }) }));
vi.mock('../src/dziri/ui', () => ({
  Notice: () => null,
  useColors: () => ({ background: '#fff' }),
}));
vi.mock('../src/dziri/use-outbox', () => ({
  useOutbox: (...args: unknown[]) => {
    state.queued = args;
    return { drafts: state.drafts, ready: true, discard: state.discard };
  },
}));
vi.mock('../src/dziri/message-composer', () => ({
  MessageComposer: (props: unknown) => {
    const [id] = React.useState(() => ++state.nextComposerInstance);
    state.composerInstance = id;
    state.composer = props;
    return null;
  },
}));
vi.mock('../src/dziri/chat-header', () => ({ ChatHeader: () => null }));
vi.mock('../src/dziri/conversation-intro', () => ({ ConversationIntro: () => null }));
vi.mock('../src/dziri/message-list', () => ({
  MessageList: (props: unknown) => {
    state.props = props;
    return null;
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  state.actor = 'alice';
  state.drafts = [];
  state.writeSupported = true;
  state.discard.mockClear();
  state.context = {
    expectedActorId: 'alice',
    readGeneration: 0,
    authorityKey: 'v1:' + 'a'.repeat(64),
  };
  state.wire.mockClear();
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
      <CommerceScreen
        {...({
          route: { params: { conversationId: 'commerce', storeId: 'store' } },
          navigation: { setOptions() {} },
        } as never)}
      />,
    ),
  );
function command() {
  const s = state.props.exactReceipts.scope;
  return {
    expectedActorId: s.actorId,
    threadId: s.threadId,
    epoch: s.epoch,
    revision: s.revision,
    readGeneration: s.readGeneration,
    kind: 'read',
    messageIds: ['incoming'],
  };
}
test('actual Commerce screen binds its canonical endpoint and inline receipt renderer', async () => {
  await render();
  expect(state.props.exactReceipts.state).toBe('inline');
  await state.props.exactReceipts.send(command());
  expect(state.wire).toHaveBeenCalledWith('marketplaceMessages:markConversationAsRead', {
    conversationId: 'commerce',
    storeId: 'store',
    messageIds: ['incoming'],
    observation: state.context,
  });
  expect(state.props.messages.find((m: any) => m.id === 'team').status).toBe('sent');
  expect(state.props.messages.find((m: any) => m.id === 'incoming').status).toBeUndefined();
});

test('actual Commerce send uses the scope captured into the durable outbox command', async () => {
  await render();
  const captured = state.queued[3];
  expect(state.composer.full).toBe(false);
  await state.queued[0]({ id: 'queued-id', body: 'Synthetic', marketplaceScope: captured });
  expect(state.wire).toHaveBeenCalledWith('marketplaceMessages:sendMessage', {
    ...captured,
    content: 'Synthetic',
    clientMessageId: 'queued-id',
  });
  state.context = { ...state.context, authorityKey: 'v1:' + 'b'.repeat(64) };
  await render();
  state.wire.mockClear();
  await expect(
    state.queued[0]({ id: 'queued-id', body: 'Synthetic', marketplaceScope: captured }),
  ).rejects.toThrow('Messaging access changed');
  expect(state.wire).not.toHaveBeenCalled();
});
test('another store employee cannot confirm this account’s queued command identifier', async () => {
  await render();
  expect(state.queued[1]).not.toContain('foreign-key');
});
test('older server leaves native drafts intact while disabling unbound sends', async () => {
  state.writeSupported = false;
  await render();
  expect(state.composer.unavailable).toBe(true);
  expect(state.composer.full).toBe(false);
  await expect(state.queued[0]({ id: 'old', body: 'Synthetic' })).rejects.toThrow();
  expect(state.wire).not.toHaveBeenCalled();
});
test('replacement native account cannot dispatch a recovered command captured by its predecessor', async () => {
  await render();
  const captured = state.queued[3];
  state.actor = 'bob';
  state.context = {
    ...state.context,
    expectedActorId: 'bob',
    authorityKey: 'v1:' + 'b'.repeat(64),
  };
  await render();
  state.wire.mockClear();
  await expect(
    state.queued[0]({ id: 'old-id', body: 'Retained', marketplaceScope: captured }),
  ).rejects.toThrow('Messaging access changed');
  expect(state.wire).not.toHaveBeenCalled();
});
test('grant replacement disposes the old native media composer while its encrypted draft scope is retained', async () => {
  await render();
  const instance = state.composerInstance,
    scope = state.composer.draftScope;
  state.context = { ...state.context, authorityKey: 'v1:' + 'b'.repeat(64) };
  await render();
  expect(state.composerInstance).not.toBe(instance);
  expect(state.composer.draftScope).toBe(scope);
});
test.each(['stale actor', 'older backend', 'revoked context'])(
  '%s leaves the actual Commerce observer disabled',
  async kind => {
    if (kind === 'stale actor') state.actor = 'bob';
    else state.context = kind === 'older backend' ? undefined : null;
    await render();
    expect(state.props.exactReceipts.scope).toBeNull();
    await expect(state.props.exactReceipts.send({})).rejects.toThrow('Stale observation');
    expect(state.wire).not.toHaveBeenCalled();
  },
);

test('Marketplace legacy intent is held for review without sending or rebinding its store context', async () => {
  state.drafts = [
    {
      id: 'legacy',
      body: 'Retained store message',
      createdAt: 1,
      status: 'failed',
      media: { type: 'image', storageId: 'storage', uri: 'local', mime: 'image/jpeg', size: 3 },
    },
  ];
  await render();
  const row = state.props.messages.find((row: any) => row.id === 'legacy');
  expect(row.held).toBe(true);
  await act(async () => state.props.review(row));
  expect(state.composer.review.body).toBe('Retained store message');
  expect(state.composer.review.attachment).toBeTruthy();
  expect(await state.composer.removeLocal('unselected')).toBe(false);
  expect(await state.composer.removeLocal('legacy')).toBe(true);
  expect(state.discard).toHaveBeenCalledExactlyOnceWith(state.drafts[0]);
  expect(state.wire).not.toHaveBeenCalled();
});
