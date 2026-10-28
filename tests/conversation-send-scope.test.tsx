import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { ConversationScreen } from '../src/dziri/conversation';
const state = vi.hoisted(() => ({
  actor: 'alice',
  key: 'v1:' + 'a'.repeat(64),
  supported: true,
  writable: true,
  scopeAvailable: true,
  discard: vi.fn(async () => true),
  queued: [] as any[],
  composer: undefined as any,
  list: undefined as any,
  composerId: 0,
  listId: 0,
  next: 0,
  wire: vi.fn(async () => 'server'),
  drafts: [] as any[],
}));
vi.mock('convex/react', () => ({
  useQuery: (ref: any) => {
    const name = getFunctionName(ref);
    return name === 'users:getMe'
      ? { _id: state.actor }
      : name === 'messaging/messenger:thread'
        ? {
            _id: 'chat',
            type: 'group',
            myRole: 'member',
            canSend: state.writable,
            encryption: 'server',
            writeContext: state.scopeAvailable
              ? { expectedActorId: state.actor, authorityKey: state.key }
              : undefined,
          }
        : { features: { personalWriteScope: state.supported ? 1 : 0 } };
  },
  useMutation: (ref: any) => (args: any) => state.wire(getFunctionName(ref), args),
  usePaginatedQuery: () => ({
    status: 'Exhausted',
    results: [
      {
        _id: 'foreign',
        senderId: 'peer',
        clientMessageId: 'same-id',
        type: 'text',
        body: 'Synthetic',
        createdAt: 1,
        reactionSummary: [],
      },
    ],
  }),
  useConvexConnectionState: () => ({ isWebSocketConnected: true }),
}));
vi.mock('react-native', () => ({
  KeyboardAvoidingView: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Platform: { OS: 'web' },
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
vi.mock('../src/dziri/locale', () => ({ useLocale: () => ({ locale: 'en', t: {} }) }));
vi.mock('../src/dziri/ui', () => ({ Notice: () => null, useColors: () => ({}) }));
vi.mock('../src/dziri/use-receipts', () => ({ useReceiptScope: () => ({}) }));
vi.mock('../src/dziri/use-typing', () => ({ useTyping: () => ({ people: [] }) }));
vi.mock('../src/dziri/use-outbox', () => ({
  useOutbox: (...args: any[]) => {
    state.queued = args;
    return { drafts: state.drafts, ready: true, discard: state.discard };
  },
}));
vi.mock('../src/dziri/message-composer', () => ({
  MessageComposer: (props: any) => {
    const [id] = React.useState(() => ++state.next);
    state.composerId = id;
    state.composer = props;
    return <div data-testid="mock-composer" />;
  },
}));
vi.mock('../src/dziri/message-list', () => ({
  MessageList: (props: any) => {
    const [id] = React.useState(() => ++state.next);
    state.listId = id;
    state.list = props;
    return null;
  },
}));
vi.mock('../src/dziri/chat-header', () => ({ ChatHeader: () => null }));
vi.mock('../src/dziri/conversation-intro', () => ({ ConversationIntro: () => null }));
vi.mock('../src/dziri/forward-message', () => ({ ForwardMessage: () => null }));
vi.mock('../src/dziri/request-report', () => ({ RequestBanner: () => null }));
vi.mock('../src/dziri/support', () => ({ SupportConnection: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  state.actor = 'alice';
  state.key = 'v1:' + 'a'.repeat(64);
  state.supported = true;
  state.writable = true;
  state.scopeAvailable = true;
  state.discard.mockClear();
  state.drafts = [];
  state.composer = undefined;
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
      <ConversationScreen
        {...({ route: { params: { threadId: 'chat' } }, navigation: { setOptions() {} } } as never)}
      />,
    ),
  );
test('actual conversation carries captured text and media scope and confirms only its own messages', async () => {
  await render();
  const scope = state.queued[4];
  expect(scope.commandContext.expectedActorId).toBe('alice');
  expect(state.queued[1]).toEqual([]);
  await state.queued[0]({ id: 'text', body: 'Synthetic', personalScope: scope });
  await state.queued[0]({
    id: 'media',
    body: '',
    personalScope: scope,
    media: { type: 'voice', storageId: 'storage', mime: 'audio/mp4', size: 3 },
  });
  expect(state.wire.mock.calls.map(([, args]: any) => args.commandContext)).toEqual([
    scope.commandContext,
    scope.commandContext,
  ]);
});
test('grant change retires only the composer and current transport rejects restored old and unbound intent', async () => {
  await render();
  const old = state.queued[4],
    composer = state.composerId,
    list = state.listId;
  state.key = 'v1:' + 'b'.repeat(64);
  await render();
  expect(state.composerId).not.toBe(composer);
  expect(state.listId).toBe(list);
  await expect(
    state.queued[0]({ id: 'old', body: 'Synthetic', personalScope: old }),
  ).rejects.toThrow('Messaging access changed');
  await expect(state.queued[0]({ id: 'legacy', body: 'Synthetic' })).rejects.toThrow(
    'Messaging access changed',
  );
  expect(state.wire).not.toHaveBeenCalled();
});
test('unsupported server holds the composer without granting an unbound fallback', async () => {
  state.supported = false;
  await render();
  expect(state.composer.unavailable).toBe(true);
  expect(state.composer.full).toBe(false);
  expect(state.queued[4]).toBeUndefined();
  expect(host.textContent).toContain('Your draft is kept');
});
test('a legacy queue entry is held for explicit review and passed to the composer without transport', async () => {
  state.drafts = [{ id: 'legacy', body: 'Retained original', createdAt: 1, status: 'failed' }];
  await render();
  expect(state.list.messages[0].held).toBe(true);
  await act(async () => state.list.review(state.list.messages[0]));
  expect(state.composer.review.body).toBe('Retained original');
  expect(state.wire).not.toHaveBeenCalled();
});

test('a readable but read-only conversation permits local review and removal without enabling send', async () => {
  state.writable = false;
  state.drafts = [{ id: 'legacy', body: 'Retained original', createdAt: 1, status: 'failed' }];
  await render();
  await act(async () => state.list.review(state.list.messages[0]));
  expect(state.composer.review.body).toBe('Retained original');
  expect(state.composer.unavailable).toBe(true);
  expect(await state.composer.removeLocal('different')).toBe(false);
  expect(await state.composer.removeLocal('legacy')).toBe(true);
  expect(state.discard).toHaveBeenCalledExactlyOnceWith(state.drafts[0]);
  expect(state.wire).not.toHaveBeenCalled();
});

test('actual DM keeps pending request intent held through denial/restoration and the current transport refuses its old grant', async () => {
  await render();
  const captured = state.queued[4];
  const original = {
    id: 'request-command',
    body: 'Retained introduction',
    createdAt: 1,
    status: 'failed',
    personalScope: captured,
  };
  state.drafts = [original];
  await render();
  expect(state.list.messages[0].held).toBe(false);
  state.writable = false;
  state.key = 'v1:' + 'b'.repeat(64);
  await render();
  expect(state.list.messages[0].held).toBe(true);
  await act(async () => state.list.review(state.list.messages[0]));
  expect(state.composer.unavailable).toBe(true);
  expect(state.composer.review.body).toBe(original.body);
  await render();
  expect(state.composer.review.body).toBe(original.body);
  state.writable = true;
  state.scopeAvailable = true;
  state.key = 'v1:' + 'c'.repeat(64);
  await render();
  expect(state.list.messages[0].held).toBe(true);
  expect(state.composer.review).toBeNull();
  await expect(state.queued[0](original)).rejects.toThrow('Messaging access changed');
  expect(original.personalScope.commandContext.authorityKey).toBe(
    captured.commandContext.authorityKey,
  );
  expect(state.wire).not.toHaveBeenCalled();
});

test('the family schedule closed shape holds native intent through reopening without an unbound send', async () => {
  await render();
  const captured = state.queued[4];
  const original = {
    id: 'scheduled-command',
    body: 'Retained scheduled draft',
    createdAt: 1,
    status: 'failed',
    personalScope: captured,
  };
  state.drafts = [original];
  state.writable = false;
  state.scopeAvailable = false;
  await render();
  expect(host.querySelector('[data-testid="mock-composer"]')).toBeNull();
  await act(async () => state.list.review(state.list.messages[0]));
  expect(state.composer.unavailable).toBe(true);
  expect(state.list.messages[0].held).toBe(true);
  state.writable = true;
  state.scopeAvailable = true;
  state.key = 'v1:' + 'd'.repeat(64);
  await render();
  expect(state.list.messages[0].held).toBe(true);
  await expect(state.queued[0](original)).rejects.toThrow('Messaging access changed');
  expect(original.personalScope).toEqual(captured);
  expect(state.wire).not.toHaveBeenCalled();
});
