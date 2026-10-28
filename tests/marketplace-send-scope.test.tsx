import { expect, test, vi } from 'vitest';
import { createOutbox } from '../src/dziri/outbox';
import { createMessageVault } from '../src/dziri/message-vault';
import {
  captureMarketplaceWriteScope,
  assertMarketplaceWriteScope,
  marketplaceDraftScope,
} from '../src/dziri/message-writes.generated';
const scope = captureMarketplaceWriteScope({
  actorId: 'alice',
  conversationId: 'chat',
  storeId: 'store',
  supported: true,
  context: { expectedActorId: 'alice', authorityKey: 'v1:' + 'a'.repeat(64) },
})!;
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
test('shared draft scopes can still open DM’s existing encrypted buyer and store journals', async () => {
  let disk: string | null = null;
  const io = {
    read: async () => disk,
    write: async (value: string) => {
      disk = value;
    },
    remove: async () => {},
    seal: async (value: string) => value,
    open: async (value: string) => value,
  };
  const saved = createMessageVault(io);
  await saved.save('marketplace:buyer:chat', { body: 'Existing buyer text' });
  await saved.save('marketplace:store:chat', { body: 'Existing store text' });
  const reopened = createMessageVault(io);
  expect((await reopened.read(marketplaceDraftScope('chat'))).body).toBe('Existing buyer text');
  expect((await reopened.read(marketplaceDraftScope('chat', 'store'))).body).toBe(
    'Existing store text',
  );
});
test('outbox snapshots retain captured access through persistence, failed retry and restoration', async () => {
  const send = vi.fn(async () => {
    throw Error('lost acknowledgement');
  });
  let saved: any[] = [];
  const box = createOutbox(
    send,
    () => 'queued-command',
    () => {},
    () => 1,
    async rows => {
      saved = rows;
    },
    scope,
  );
  box.enqueue('Synthetic');
  await flush();
  expect(saved[0].marketplaceScope).toEqual(scope);
  expect(send.mock.calls[0][0].marketplaceScope).toEqual(scope);
  const restored = createOutbox(
    send,
    () => 'new-command',
    () => {},
    () => 1,
    undefined,
    scope,
  );
  restored.restore(saved);
  await flush();
  expect(send).toHaveBeenCalledTimes(1);
  restored.retry('queued-command');
  await flush();
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1][0].marketplaceScope).toEqual(scope);
});
test('a recovered old grant and a legacy unbound command cannot be rebound to new access', async () => {
  const current = captureMarketplaceWriteScope({
    actorId: 'alice',
    conversationId: 'chat',
    storeId: 'store',
    supported: true,
    context: { ...scope.commandContext, authorityKey: 'v1:' + 'b'.repeat(64) },
  })!;
  const wire = vi.fn(),
    send = async (draft: any) => {
      assertMarketplaceWriteScope(current, draft.marketplaceScope);
      await wire(draft);
    };
  let rows: any[] = [];
  const box = createOutbox(
    send,
    () => 'new',
    value => {
      rows = value;
    },
    () => 1,
    undefined,
    current,
  );
  box.restore([
    { id: 'old', body: 'Retained', createdAt: 1, status: 'failed', marketplaceScope: scope },
    { id: 'legacy', body: 'Retained legacy', createdAt: 1, status: 'failed' },
  ]);
  box.retry('old');
  box.retry('legacy');
  await flush();
  expect(wire).not.toHaveBeenCalled();
  expect(rows.map(r => [r.body, r.status])).toEqual([
    ['Retained', 'failed'],
    ['Retained legacy', 'failed'],
  ]);
});
test('encrypted journal preserves valid captured intent and rejects malformed persisted metadata', async () => {
  let disk: string | null = null;
  const io = {
    read: async () => disk,
    write: async (s: string) => {
      disk = s;
    },
    remove: async () => {},
    seal: async (s: string) => s,
    open: async (s: string) => s,
  };
  const vault = createMessageVault(io, () => 2);
  await vault.save('marketplace:chat', {
    pending: [
      { id: 'safe', body: 'Synthetic', createdAt: 1, status: 'failed', marketplaceScope: scope },
    ],
  });
  expect(
    (await createMessageVault(io, () => 2).read('marketplace:chat')).pending[0].marketplaceScope,
  ).toEqual(scope);
  const malformed = {
    ...scope,
    commandContext: { ...scope.commandContext, authorityKey: 'invalid' },
  };
  await expect(
    vault.save('marketplace:chat', {
      pending: [
        {
          id: 'bad',
          body: 'Synthetic',
          createdAt: 1,
          status: 'failed',
          marketplaceScope: malformed,
        },
      ],
    }),
  ).rejects.toThrow();
});
