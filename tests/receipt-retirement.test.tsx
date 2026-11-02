import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import {
  createReceiptObserver,
  createReactionInboxObserver,
  createMarketplaceReceiptAdapter,
  type ReceiptCommand,
} from '../src/dziri/message-receipts.generated';
const scope = {
  actorId: 'alice',
  threadId: 'market',
  epoch: 0,
  revision: 0,
  readGeneration: 0,
};
const source = {
  conversationId: 'commerce',
  storeId: 'store',
  observation: {
    expectedActorId: 'alice',
    readGeneration: 0,
    authorityKey: 'v1:' + 'a'.repeat(64),
  },
};
const retired = () => new ConvexError({ code: 'MESSENGER_RECEIPT_RETIRED' });
const dispose: (() => void)[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  dispose.splice(0).forEach(fn => fn());
  vi.useRealTimers();
});
test.each(['read', 'delivered'] as const)(
  'a typed permanent %s denial stops retries without reauthorizing the old observation',
  async kind => {
    const send = vi.fn(async (_command: ReceiptCommand): Promise<null> => {
      throw retired();
    });
    const observer = createReceiptObserver(send);
    dispose.push(() => observer.dispose());
    observer.configure(scope, true);
    if (kind === 'read') observer.visible(['message']);
    else observer.received(['message']);
    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledOnce();
    send.mockResolvedValue(null);
    observer.configure(scope, true);
    if (kind === 'read') observer.visible(['message']);
    else observer.received(['message']);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(send).toHaveBeenCalledOnce();
    observer.configure(scope, false);
    observer.configure(scope, true);
    if (kind === 'read') observer.visible(['message']);
    else observer.received(['message']);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(send).toHaveBeenCalledOnce();
    observer.configure({ ...scope, authorityKey: 'v1:' + 'b'.repeat(64) }, true);
    if (kind === 'read') observer.visible(['message']);
    else observer.received(['message']);
    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledTimes(2);
  },
);
test('permanent private reaction denial stops retries for that source/head and fresh authority can resume', async () => {
  const send = vi.fn(async (): Promise<{ more: boolean }> => {
    throw retired();
  });
  const observer = createReactionInboxObserver(send);
  dispose.push(() => observer.dispose());
  observer.configure(source, true, 'head');
  await vi.advanceTimersByTimeAsync(500);
  expect(send).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(send).toHaveBeenCalledOnce();
  send.mockResolvedValue({ more: false });
  observer.configure(source, true, 'head');
  await vi.advanceTimersByTimeAsync(2_000);
  expect(send).toHaveBeenCalledOnce();
  observer.configure(source, false, 'other-head');
  observer.configure(source, true, 'other-head');
  await vi.advanceTimersByTimeAsync(2_000);
  expect(send).toHaveBeenCalledOnce();
  observer.configure(
    {
      ...source,
      observation: {
        ...source.observation,
        authorityKey: 'v1:' + 'b'.repeat(64),
      },
    },
    true,
    'head',
  );
  await vi.advanceTimersByTimeAsync(500);
  expect(send).toHaveBeenCalledTimes(2);
});
test.each(['network', 'Unauthorized', 'MESSENGER_RECEIPT_RETIRED'])(
  'unstructured %s failures still recover without parsing message strings',
  async message => {
    const send = vi
      .fn(async (_command: ReceiptCommand): Promise<null> => null)
      .mockRejectedValueOnce(new Error(message));
    const observer = createReceiptObserver(send);
    dispose.push(() => observer.dispose());
    observer.configure(scope, true);
    observer.received(['message']);
    await vi.advanceTimersByTimeAsync(1_100);
    expect(send).toHaveBeenCalledTimes(2);
    const reaction = vi
      .fn(async (): Promise<{ more: boolean }> => ({ more: false }))
      .mockRejectedValueOnce(new Error(message));
    const inbox = createReactionInboxObserver(reaction);
    dispose.push(() => inbox.dispose());
    inbox.configure(source, true, 'head');
    await vi.advanceTimersByTimeAsync(1_600);
    expect(reaction).toHaveBeenCalledTimes(2);
  },
);
test('a late retirement from an older authority cannot retire its replacement', async () => {
  let reject!: (error: unknown) => void;
  const send = vi
    .fn(async (_command: ReceiptCommand): Promise<null> => null)
    .mockImplementationOnce(
      () =>
        new Promise<null>((_resolve, fail) => {
          reject = fail;
        }),
    );
  const observer = createReceiptObserver(send);
  dispose.push(() => observer.dispose());
  observer.configure(scope, true);
  observer.received(['old']);
  await vi.advanceTimersByTimeAsync(0);
  observer.configure({ ...scope, authorityKey: 'v1:' + 'b'.repeat(64) }, true);
  observer.received(['fresh']);
  reject(retired());
  await vi.advanceTimersByTimeAsync(3_000);
  expect(send.mock.calls.map(([command]) => command.messageIds)).toEqual([['old'], ['fresh']]);
  observer.received(['fresh', 'new']);
  await vi.advanceTimersByTimeAsync(0);
  expect(send.mock.calls.at(-1)?.[0].messageIds).toEqual(['new']);
});
test('a local captured-scope mismatch carries the same structured retirement code', async () => {
  const wire = vi.fn(async () => null);
  const adapter = createMarketplaceReceiptAdapter(
    {
      actorId: 'alice',
      conversationId: 'commerce',
      context: source.observation,
    },
    wire,
  );
  await expect(
    adapter.send({
      ...adapter.scope!,
      expectedActorId: 'bob',
      kind: 'read',
      messageIds: ['message'],
    }),
  ).rejects.toMatchObject({ data: { code: 'MESSENGER_RECEIPT_RETIRED' } });
  expect(wire).not.toHaveBeenCalled();
});
